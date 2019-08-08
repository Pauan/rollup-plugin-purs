use wasm_bindgen::prelude::*;
use crate::{Context, Options};


#[wasm_bindgen]
pub fn optimize(context: Context, code: &str, options: Options) -> String {
    console_error_panic_hook::set_once();

    "Hi".to_string()
}
