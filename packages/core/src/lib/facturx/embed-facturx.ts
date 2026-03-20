import { randomBytes } from 'node:crypto';
import { PDFDocument, AFRelationship, PDFHexString, PDFName, PDFString } from 'pdf-lib';
import { setXmpMetadata } from './build-xmp-metadata.js';
import { getSrgbIccProfile } from './srgb-icc-profile.js';

const FACTURX_FILENAME = 'factur-x.xml';
const CREATOR = 'Tuldio Factur-X generator';

export interface FacturXMetadata {
  title: string;
  subject: string;
  author: string;
}

/**
 * Embed Factur-X XML into a PDF buffer, producing a PDF/A-3B compliant document.
 *
 * Strategy: pdf-lib cannot round-trip Puppeteer PDFs (catalog entries get lost).
 * Instead, we create a fresh pdf-lib document and copy the Puppeteer pages into it.
 * All PDF/A-3 structures (XMP, ICC, OutputIntent, XML attachment) are added to the
 * fresh document where the catalog is fully controlled by pdf-lib.
 */
export async function embedFacturX(input: {
  pdf: Buffer;
  xml: string;
  metadata: FacturXMetadata;
}): Promise<Buffer> {
  const sourcePdf = await PDFDocument.load(new Uint8Array(input.pdf));
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const now = new Date();

  // Copy all pages from the Puppeteer PDF into our fresh document
  const pages = await pdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
  for (const page of pages) {
    pdf.addPage(page);
  }

  // Generate unique document ID for PDF/A-3 trailer
  const documentId = randomBytes(16).toString('hex');
  const hexId = PDFHexString.of(documentId);
  pdf.context.trailerInfo.ID = pdf.context.obj([hexId, hexId]);

  // Embed XML as file attachment with proper AFRelationship
  const xmlBytes = new TextEncoder().encode(input.xml);
  await pdf.attach(xmlBytes, FACTURX_FILENAME, {
    afRelationship: AFRelationship.Data,
    mimeType: 'text/xml',
    creationDate: now,
    modificationDate: now,
    description: 'Factur-X XML file',
  });

  // Set PDF document info dictionary (must match XMP metadata for PDF/A compliance)
  pdf.setLanguage('fr-FR');
  pdf.setCreationDate(now);
  pdf.setModificationDate(now);
  pdf.setTitle(input.metadata.title);
  pdf.setSubject(input.metadata.subject);
  pdf.setAuthor(input.metadata.author);
  pdf.setKeywords(['Invoice', 'Factur-X']);
  pdf.setCreator(CREATOR);
  pdf.setProducer(CREATOR);

  // Embed sRGB ICC profile as OutputIntent (required for PDF/A-3B color compliance)
  const iccProfile = getSrgbIccProfile();
  const profileStream = pdf.context.stream(iccProfile, {
    N: 3, // RGB = 3 color components
    Length: iccProfile.length,
  });
  const profileStreamRef = pdf.context.register(profileStream);
  const outputIntent = pdf.context.obj({
    Type: 'OutputIntent',
    S: 'GTS_PDFA1',
    OutputConditionIdentifier: PDFString.of('sRGB'),
    DestOutputProfile: profileStreamRef,
  });
  const outputIntentRef = pdf.context.register(outputIntent);
  pdf.catalog.set(PDFName.of('OutputIntents'), pdf.context.obj([outputIntentRef]));

  // Write PDF/A-3B XMP metadata to catalog
  setXmpMetadata({
    date: now,
    documentId,
    title: input.metadata.title,
    subject: input.metadata.subject,
    author: input.metadata.author,
    producer: CREATOR,
    creator: CREATOR,
    filename: FACTURX_FILENAME,
    conformanceLevel: 'EN 16931',
  }, pdf);

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
