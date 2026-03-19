#!/bin/bash
# Patch Baileys to use MACOS platform instead of WEB
# WhatsApp servers reject WEB platform since Feb 2026 (405 Connection Failure)
# See: https://github.com/WhiskeySockets/Baileys/issues/2377

BAILEYS_FILE=$(find node_modules -path "*/baileys/lib/Utils/validate-connection.js" 2>/dev/null | head -1)

if [ -z "$BAILEYS_FILE" ]; then
  exit 0
fi

if grep -q "Platform.WEB," "$BAILEYS_FILE"; then
  sed -i.bak 's/platform: proto.ClientPayload.UserAgent.Platform.WEB,/platform: proto.ClientPayload.UserAgent.Platform.MACOS,/' "$BAILEYS_FILE"
  rm -f "${BAILEYS_FILE}.bak"
  echo "Patched Baileys: WEB -> MACOS platform"
fi
