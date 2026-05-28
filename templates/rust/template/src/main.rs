fn main() {
    let args = std::env::args_os();
    let cwd = std::env::current_dir();
    let result = rootward_token_crate_module_name::run_cli(args, cwd);
    print!("{}", result.stdout);
    eprint!("{}", result.stderr);
    std::process::exit(result.exit_code);
}
