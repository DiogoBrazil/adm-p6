import { defineConfig } from "vite";

// O watcher do Vite não pode entrar em `src-tauri/`.
//
// Sem este arquivo o Vite vigia a raiz inteira, e `src-tauri/target/xwin-cache/`
// — o SDK do Windows que o `cargo-xwin` baixa para o build cruzado — tem um
// symlink self-referencial de propósito (`lib/10.0.26100 -> .`, para que
// `lib/um` e `lib/10.0.26100/um` sejam o mesmo lugar). O chokidar o segue até
// estourar, e o `npm run tauri dev` morre antes de abrir a janela:
//
//   Error: ELOOP: too many symbolic links encountered, stat
//   '.../xwin/sdk/lib/10.0.26100/10.0.26100/10.0.26100/...'
//
// O erro é do `beforeDevCommand`, não do app, então não diz nada sobre Tauri
// nem sobre Rust — e só aparece em quem já gerou o instalador do Windows uma
// vez. Nada em `src-tauri/` é servido ao navegador; recompilar o Rust é
// trabalho do próprio `tauri dev`, que tem o watcher dele.
export default defineConfig({
  server: {
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
