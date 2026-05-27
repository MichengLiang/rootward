use serde::Serialize;

use super::errors::CliError;

#[derive(Serialize)]
#[serde(untagged)]
pub enum CommandResult<T> {
    Ok { ok: bool, data: T },
    Err { ok: bool, error: CliError },
}

pub fn ok<T>(data: T) -> CommandResult<T> {
    CommandResult::Ok { ok: true, data }
}

pub fn err<T>(error: CliError) -> CommandResult<T> {
    CommandResult::Err { ok: false, error }
}
