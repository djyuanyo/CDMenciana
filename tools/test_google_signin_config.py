import unittest

from check_google_signin import normalize_sha1, verify_google_config


SHA = "6729fe7daaa885141ea0444e9ad4115de9812450"


def config(hash_value=SHA, project="barpro-pos-menciana"):
    return {
        "project_info": {"project_id": project},
        "client": [{
            "client_info": {"android_client_info": {"package_name": "es.cdmenciana.app"}},
            "oauth_client": [
                {"client_type": 1, "android_info": {
                    "package_name": "es.cdmenciana.app", "certificate_hash": hash_value}},
                {"client_type": 3, "client_id": "web-client.apps.googleusercontent.com"},
            ],
        }],
    }


class GoogleSignInSigningTest(unittest.TestCase):
    def test_correct_apk_signer_allowed(self):
        self.assertEqual(verify_google_config(config(), "67:29:FE:7D:AA:A8:85:14:1E:A0:44:4E:9A:D4:11:5D:E9:81:24:50"), SHA)

    def test_other_signing_key_refused(self):
        with self.assertRaisesRegex(ValueError, "firma SHA-1"):
            verify_google_config(config("3c5e10f2ea25d77661be566bdad134d6f22f2c17"), SHA)

    def test_web_client_alone_is_not_enough(self):
        data = config()
        data["client"][0]["oauth_client"] = data["client"][0]["oauth_client"][1:]
        with self.assertRaisesRegex(ValueError, "firma SHA-1"):
            verify_google_config(data, SHA)

    def test_wrong_firebase_project_rejected(self):
        with self.assertRaisesRegex(ValueError, "otro proyecto"):
            verify_google_config(config(project="other"), SHA)

    def test_malformed_fingerprint_rejected(self):
        with self.assertRaises(ValueError):
            normalize_sha1("not-a-sha")

    def test_missing_web_client_rejected(self):
        data = config()
        data["client"][0]["oauth_client"] = data["client"][0]["oauth_client"][:1]
        with self.assertRaisesRegex(ValueError, "cliente OAuth web"):
            verify_google_config(data, SHA)


if __name__ == "__main__":
    unittest.main()
