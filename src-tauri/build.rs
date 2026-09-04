fn main() {
    // As credenciais do banco entram no binário por `option_env!`
    // (`app_state.rs::definicao`), e o `option_env!` é resolvido na COMPILAÇÃO.
    // Sem estas linhas o cargo não sabe que o resultado depende delas: mudar a
    // senha e recompilar devolveria o binário em cache, com a senha velha e sem
    // aviso nenhum.
    for chave in [
        "ADMP6_DB_HOST",
        "ADMP6_DB_PORT",
        "ADMP6_DB_NAME",
        "ADMP6_DB_USER",
        "ADMP6_DB_PASSWORD",
        "ADMP6_DB_SSLMODE",
    ] {
        println!("cargo:rerun-if-env-changed={chave}");
    }

    tauri_build::build()
}
