// Stable UTF-8 JSON C ABI. Each returned string must be freed exactly once.
use std::ffi::{c_char, CStr, CString};
fn execute(input: &str) -> String {
    let outcome = std::panic::catch_unwind(|| -> Result<serde_json::Value, String> {
        if input.len() > 8 * 1024 * 1024 {
            return Err("Request exceeds 8 MiB".into());
        }
        let request = serde_json::from_str(input).map_err(|e| e.to_string())?;
        crate::dispatch(request)
    });
    match outcome {
        Ok(Ok(value)) => serde_json::json!({"ok": true, "value": value}).to_string(),
        Ok(Err(error)) => serde_json::json!({"ok": false, "error": error}).to_string(),
        Err(_) => {
            serde_json::json!({"ok": false, "error": "Internal panic contained at ABI boundary"})
                .to_string()
        }
    }
}
/// # Safety
/// input must be null or point to a valid NUL-terminated UTF-8 string.
#[no_mangle]
pub unsafe extern "C" fn lb_request(input: *const c_char) -> *mut c_char {
    let result = if input.is_null() {
        "{\"ok\":false,\"error\":\"Null input\"}".into()
    } else {
        match CStr::from_ptr(input).to_str() {
            Ok(text) => execute(text),
            Err(_) => "{\"ok\":false,\"error\":\"Invalid UTF-8\"}".into(),
        }
    };
    CString::new(result).unwrap().into_raw()
}
/// # Safety
/// ptr must be null or a live pointer returned by lb_request. Free only once.
#[no_mangle]
pub unsafe extern "C" fn lb_free(ptr: *mut c_char) {
    if !ptr.is_null() {
        drop(CString::from_raw(ptr));
    }
}
#[cfg(feature = "node")]
#[napi_derive::napi]
pub fn request(input: String) -> String {
    execute(&input)
}

#[cfg(feature = "wasm")]
#[wasm_bindgen::prelude::wasm_bindgen(js_name = request)]
pub fn wasm_request(input: &str) -> String {
    execute(input)
}
