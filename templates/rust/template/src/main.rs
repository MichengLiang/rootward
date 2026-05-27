include!("lib.rs");

fn main() {
    let result = run_cli(std::env::args_os(), std::env::current_dir());
    print!("{}", result.stdout);
    eprint!("{}", result.stderr);
    std::process::exit(result.exit_code);
}
