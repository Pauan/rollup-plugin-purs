use std::borrow::Cow;
use std::collections::HashMap;

use wasm_bindgen::prelude::*;
use lazy_static::lazy_static;
use regex::Regex;

use crate::Context;
use crate::parser;


macro_rules! log {
    ($($args:tt)*) => {
        web_sys::console::log_1(&JsValue::from(&format!($($args)*)));
    };
}


#[wasm_bindgen]
pub fn convert(context: Context, file: &str, filename: &str) -> Result<String, JsValue> {
    console_error_panic_hook::set_once();


    lazy_static! {
        static ref PRAGMA: Regex = Regex::new(r"(?:^|\n|\r\n)// rollup-plugin-purs (.+)").unwrap_throw();
    }

    let mut warn_on_dynamic_exports = true;
    let mut warn_on_dynamic_require = true;
    let mut warn_on_dynamic_module = true;

    let mut imports: HashMap<Cow<'_, str>, &'_ str> = HashMap::new();
    let mut exports: HashMap<Cow<'_, str>, Cow<'_, str>> = HashMap::new();

    log!("HIIII");

    for cap in PRAGMA.captures_iter(file) {
        log!("Cap {}", &cap[1]);

        let pragma = &cap[1];

        match pragma {
            "ignore dynamic exports" => {
                warn_on_dynamic_exports = false;
            },
            "ignore dynamic require" => {
                warn_on_dynamic_require = false;
            },
            "ignore dynamic module" => {
                warn_on_dynamic_module = false;
            },
            _ => {
                Err(JsValue::from(format!("Unknown rollup-plugin-purs pragma: {}", pragma)))?;
            },
        }
    }

    match parser::Parser::new(file, filename).parse_as_module() {
        Ok(ast) => {
            log!("{:?}", ast);
        },
        Err(err) => {
            Err(JsValue::from(err))?;
        },
    }

    Ok("Hi".to_string())
}
