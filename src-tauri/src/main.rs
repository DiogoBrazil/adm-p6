// Sem este atributo o executável do Windows nasce no subsistema **console**: o
// sistema abre um terminal atrás da janela do app, e fechar esse terminal mata o
// processo — o usuário perde o trabalho sem entender por quê. No Linux o
// atributo é ignorado, e é por isso que o `.deb` nunca mostrou o problema.
//
// `not(debug_assertions)` preserva o console em desenvolvimento, que é onde o
// log do WebView e as mensagens de startup aparecem.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    adm_p6_tauri_lib::run();
}
