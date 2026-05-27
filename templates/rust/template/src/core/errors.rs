use serde::Serialize;
use serde_json::Value;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CliErrorCode {
    UsageError,
    ProjectNotFound,
    ProjectConfigNotFound,
    InitTargetInvalid,
    ProjectAlreadyInitialized,
    ConfigReadFailed,
    ConfigParseFailed,
    ConfigInvalid,
    SourceNotFound,
    SourceRootNotFound,
    ScannerNotRegistered,
    DiscoveryFailed,
    ScanFailed,
    InternalError,
}

impl CliErrorCode {
    pub fn exit_code(self) -> i32 {
        match self {
            Self::UsageError => 2,
            Self::ProjectNotFound
            | Self::ProjectConfigNotFound
            | Self::InitTargetInvalid
            | Self::ProjectAlreadyInitialized => 3,
            Self::ConfigReadFailed | Self::ConfigParseFailed | Self::ConfigInvalid => 4,
            Self::SourceNotFound => 4,
            Self::SourceRootNotFound
            | Self::ScannerNotRegistered
            | Self::DiscoveryFailed
            | Self::ScanFailed => 5,
            Self::InternalError => 1,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct CliError {
    pub code: CliErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

#[derive(Debug)]
pub struct CliFailure {
    pub exit_code: i32,
    pub error: CliError,
}

pub type CliResult<T> = Result<T, CliFailure>;

pub fn fail(code: CliErrorCode, message: impl Into<String>, details: Option<Value>) -> CliFailure {
    CliFailure {
        exit_code: code.exit_code(),
        error: CliError {
            code,
            message: message.into(),
            details,
        },
    }
}
