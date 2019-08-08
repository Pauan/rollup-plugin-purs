use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    pub type Optimizations;

    #[wasm_bindgen(method, getter)]
    fn uncurry(this: &Optimizations) -> bool;

    #[wasm_bindgen(method, getter)]
    fn inline(this: &Optimizations) -> bool;

    #[wasm_bindgen(method, getter, js_name = "removeDeadCode")]
    fn remove_dead_code(this: &Optimizations) -> bool;

    #[wasm_bindgen(method, getter, js_name = "assumePureVars")]
    fn assume_pure_vars(this: &Optimizations) -> bool;
}

#[wasm_bindgen]
extern "C" {
    pub type Options;

    #[wasm_bindgen(method, getter)]
    fn debug(this: &Options) -> Option<bool>;

    #[wasm_bindgen(method, getter)]
    fn optimizations(this: &Options) -> Option<Optimizations>;
}


#[wasm_bindgen]
extern "C" {
    pub type Context;
}

mod parser;

mod convert;
pub use convert::*;

mod optimize;
pub use optimize::*;
