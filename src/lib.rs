use wasm_bindgen::prelude::*;
use iota_signing;
use iota_conversion::Trinary;
use js_sys::Array;

#[wasm_bindgen]
pub fn generate_address(seed: &str, index: usize, security: usize, checksum: bool) -> String {
    let key = iota_signing::key(&seed.trits(), index, security).unwrap();
    let digests = iota_signing::digests(&key).unwrap();
    let address_trits = iota_signing::address(&digests).unwrap();
    let mut address = address_trits.trytes().unwrap();
    if checksum {
        address = iota_signing::checksum::add_checksum(&address).unwrap();
    }
    address
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "Array<string>")]
    type MyArray;
}

#[wasm_bindgen]
pub fn generate_addresses(seed: &str, startindex: usize, endindex: usize, security: usize, checksum: bool) -> Array {
    let mut addresses = Vec::new();
    for index in startindex..=endindex {
        let key = iota_signing::key(&seed.trits(), index, security).unwrap();
        let digests = iota_signing::digests(&key).unwrap();
        let address_trits = iota_signing::address(&digests).unwrap();
        let mut address = address_trits.trytes().unwrap();
        if checksum {
            address = iota_signing::checksum::add_checksum(&address).unwrap();
        }
        addresses.push(address);
    }
    addresses.into_iter().map(JsValue::from).collect()
}