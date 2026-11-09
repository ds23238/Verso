"""Build the shared, pinned Rust audio engine for browsers and desktop WebViews."""
from pathlib import Path
import subprocess
root = Path(__file__).resolve().parent.parent
subprocess.run(['cargo','build','--locked','--release','--target','wasm32-unknown-unknown','--manifest-path',str(root/'audio-core/Cargo.toml')],check=True)
subprocess.run(['wasm-bindgen','--target','web','--out-dir',str(root/'public/engine/audio'),'--out-name','audio',str(root/'audio-core/target/wasm32-unknown-unknown/release/verso_audio.wasm')],check=True)
