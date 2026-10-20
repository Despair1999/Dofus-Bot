use base64::{engine::general_purpose::STANDARD, Engine};
use minisign_verify::{PublicKey, Signature};

#[test]
#[ignore = "Requires an actually signed Windows installer; run with COMPANION_TEST_INSTALLER"]
fn release_signature_accepts_original_and_rejects_modified_installer() {
    let path = std::env::var("COMPANION_TEST_INSTALLER").expect("installer path");
    let config: serde_json::Value =
        serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
    let key_text = String::from_utf8(
        STANDARD
            .decode(config["plugins"]["updater"]["pubkey"].as_str().unwrap())
            .unwrap(),
    )
    .unwrap();
    let key = PublicKey::decode(&key_text).unwrap();
    let encoded = std::fs::read_to_string(format!("{path}.sig")).unwrap();
    let signature_text = String::from_utf8(STANDARD.decode(encoded.trim()).unwrap()).unwrap();
    let signature = Signature::decode(&signature_text).unwrap();
    let mut bytes = std::fs::read(&path).unwrap();
    key.verify(&bytes, &signature, false)
        .expect("original release must verify with the v0.1 public key");
    let index = bytes.len() / 2;
    bytes[index] ^= 1;
    assert!(
        key.verify(&bytes, &signature, false).is_err(),
        "changed installer must never be accepted"
    );
}
