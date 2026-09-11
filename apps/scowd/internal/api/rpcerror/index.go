package custom_error

type ErrorCode string

const (
	MainStartChildProcessError   = "MainStartChildProcessError"
	MainNotFoundIdentityId       = "MainNotFoundIdentityId"
	MainErrorParsingChildProcess = "MainErrorParsingChildProcess"
)
