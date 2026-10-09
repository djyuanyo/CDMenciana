#!/usr/bin/env python3
"""Reject Android APKs whose signing certificate has no Firebase Google OAuth client."""
import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path


def normalize_sha1(value):
    candidate = re.sub(r"[:\s]", "", str(value)).lower()
    if not re.fullmatch(r"[0-9a-f]{40}", candidate):
        raise ValueError("La huella SHA-1 de la firma Android no es válida.")
    return candidate


def verify_google_config(config, sha1, package="es.cdmenciana.app"):
    """Validate an app + certificate-specific Android OAuth client, not just the Web ID."""
    if config.get("project_info", {}).get("project_id") != "barpro-pos-menciana":
        raise ValueError("google-services.json pertenece a otro proyecto de Firebase.")
    clients = [x for x in config.get("client", [])
               if x.get("client_info", {}).get("android_client_info", {}).get("package_name") == package]
    if not clients:
        raise ValueError("google-services.json no contiene la aplicación Android es.cdmenciana.app.")
    actual = normalize_sha1(sha1)
    android = [o for client in clients for o in client.get("oauth_client", [])
               if o.get("client_type") == 1 and o.get("android_info", {}).get("package_name") == package]
    if not any(normalize_sha1(x.get("android_info", {}).get("certificate_hash", "")) == actual
               for x in android if re.fullmatch(r"[0-9a-fA-F: ]{40,59}",
                                                x.get("android_info", {}).get("certificate_hash", ""))):
        raise ValueError(
            "La firma SHA-1 de esta APK no está vinculada a un cliente OAuth Android "
            "en google-services.json. Registra la SHA-1 en Firebase > Ajustes del proyecto "
            "> Tus aplicaciones > Android y vuelve a descargar google-services.json."
        )
    if not any(o.get("client_type") == 3 and o.get("client_id")
               for c in clients for o in c.get("oauth_client", [])):
        raise ValueError("Falta el cliente OAuth web (default_web_client_id) requerido por Google.")
    return actual


def sha1_from_apk(apk_path, apksigner):
    proc = subprocess.run([str(apksigner), "verify", "--print-certs", str(apk_path)],
                          capture_output=True, text=True, check=True)
    match = re.search(r"Signer #1 certificate SHA-1 digest:\s*([a-fA-F0-9:]+)",
                      proc.stdout)
    if not match:
        raise ValueError("No se ha podido leer la huella de la firma de la APK.")
    return normalize_sha1(match.group(1))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apk", required=True, type=Path)
    parser.add_argument("--config", default="android/app/google-services.json", type=Path)
    parser.add_argument("--apksigner", type=Path, default=Path(os.environ.get("ANDROID_HOME", "")) /
                        "build-tools/36.0.0/apksigner")
    args = parser.parse_args()
    try:
        actual = sha1_from_apk(args.apk, args.apksigner)
        config = json.loads(args.config.read_text(encoding="utf-8"))
        verify_google_config(config, actual)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"::error::Google Sign-In no se puede validar: {error}", file=sys.stderr)
        return 1
    print("Google Sign-In: APK firmada y cliente OAuth Android de Firebase coinciden.")
    print("SHA-1 de la APK: " + ":".join(actual[i:i+2] for i in range(0, 40, 2)).upper())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

