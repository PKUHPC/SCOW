package sync_account_user

import pb "scow-adapters/gen/go"

func CreateAccountFailedOperation(accountName, message string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	syncOperation := &pb.SyncAccountUserInfoResponse_SyncOperationResult_CreateAccount{
		CreateAccount: &pb.SyncAccountUserInfoResponse_CreateAccountOperation{
			AccountName: accountName,
		},
	}
	result := &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation:  syncOperation,
		Success:        false,
		FailureMessage: &message,
	}
	return result
}

func CreateAccountSuccessOperation(accountName string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	syncOperation := &pb.SyncAccountUserInfoResponse_SyncOperationResult_CreateAccount{
		CreateAccount: &pb.SyncAccountUserInfoResponse_CreateAccountOperation{
			AccountName: accountName,
		},
	}
	result := &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: syncOperation,
		Success:       true,
	}
	return result
}

func BlockAccountFailedOperation(accountName, message string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	syncOperation := &pb.SyncAccountUserInfoResponse_SyncOperationResult_BlockAccount{
		BlockAccount: &pb.SyncAccountUserInfoResponse_BlockAccountOperation{
			AccountName: accountName,
		},
	}
	result := &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation:  syncOperation,
		Success:        false,
		FailureMessage: &message,
	}
	return result
}

func BlockAccountSuccessOperation(accountName string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	syncOperation := &pb.SyncAccountUserInfoResponse_SyncOperationResult_BlockAccount{
		BlockAccount: &pb.SyncAccountUserInfoResponse_BlockAccountOperation{
			AccountName: accountName,
		},
	}
	result := &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: syncOperation,
		Success:       true,
	}
	return result
}

func UnblockAccountFailedOperation(accountName, message string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	syncOperation := &pb.SyncAccountUserInfoResponse_SyncOperationResult_UnblockAccount{
		UnblockAccount: &pb.SyncAccountUserInfoResponse_UnblockAccountOperation{
			AccountName: accountName,
		},
	}
	result := &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation:  syncOperation,
		Success:        false,
		FailureMessage: &message,
	}
	return result
}

func UnblockAccountSuccessOperation(accountName string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	syncOperation := &pb.SyncAccountUserInfoResponse_SyncOperationResult_UnblockAccount{
		UnblockAccount: &pb.SyncAccountUserInfoResponse_UnblockAccountOperation{
			AccountName: accountName,
		},
	}
	result := &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: syncOperation,
		Success:       true,
	}
	return result
}

func AddUserToAccountFailedOperation(accountName, userId, message string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	syncOperation := &pb.SyncAccountUserInfoResponse_SyncOperationResult_AddUserToAccount{
		AddUserToAccount: &pb.SyncAccountUserInfoResponse_AddUserToAccountOperation{
			AccountName: accountName,
			UserId:      userId,
		},
	}
	result := &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation:  syncOperation,
		Success:        false,
		FailureMessage: &message,
	}
	return result
}

func AddUserToAccountSuccessOperation(accountName, userId string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	syncOperation := &pb.SyncAccountUserInfoResponse_SyncOperationResult_AddUserToAccount{
		AddUserToAccount: &pb.SyncAccountUserInfoResponse_AddUserToAccountOperation{
			AccountName: accountName,
			UserId:      userId,
		},
	}
	result := &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: syncOperation,
		Success:       true,
	}
	return result
}

func RemoveUserFromAccountFailedOperation(accountName, userId, message string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	syncOperation := &pb.SyncAccountUserInfoResponse_SyncOperationResult_RemoveUserFromAccount{
		RemoveUserFromAccount: &pb.SyncAccountUserInfoResponse_RemoveUserFromAccountOperation{
			AccountName: accountName,
			UserId:      userId,
		},
	}
	result := &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation:  syncOperation,
		Success:        false,
		FailureMessage: &message,
	}
	return result
}

func RemoveUserFromAccountSuccessOperation(accountName, userId string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	syncOperation := &pb.SyncAccountUserInfoResponse_SyncOperationResult_RemoveUserFromAccount{
		RemoveUserFromAccount: &pb.SyncAccountUserInfoResponse_RemoveUserFromAccountOperation{
			AccountName: accountName,
			UserId:      userId,
		},
	}
	result := &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: syncOperation,
		Success:       true,
	}
	return result
}

func BlockUserInAccountFailedOperation(accountName, userId, message string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	syncOperation := &pb.SyncAccountUserInfoResponse_SyncOperationResult_BlockUserInAccount{
		BlockUserInAccount: &pb.SyncAccountUserInfoResponse_BlockUserInAccountOperation{
			AccountName: accountName,
			UserId:      userId,
		},
	}
	result := &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation:  syncOperation,
		Success:        false,
		FailureMessage: &message,
	}
	return result
}

func BlockUserInAccountSuccessOperation(accountName, userId string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	syncOperation := &pb.SyncAccountUserInfoResponse_SyncOperationResult_BlockUserInAccount{
		BlockUserInAccount: &pb.SyncAccountUserInfoResponse_BlockUserInAccountOperation{
			AccountName: accountName,
			UserId:      userId,
		},
	}
	result := &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: syncOperation,
		Success:       true,
	}
	return result
}

func UnblockUserInAccountFailedOperation(accountName, userId, message string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	syncOperation := &pb.SyncAccountUserInfoResponse_SyncOperationResult_UnblockUserInAccount{
		UnblockUserInAccount: &pb.SyncAccountUserInfoResponse_UnblockUserInAccountOperation{
			AccountName: accountName,
			UserId:      userId,
		},
	}
	result := &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation:  syncOperation,
		Success:        false,
		FailureMessage: &message,
	}
	return result
}

func UnblockUserInAccountSuccessOperation(accountName, userId string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	syncOperation := &pb.SyncAccountUserInfoResponse_SyncOperationResult_UnblockUserInAccount{
		UnblockUserInAccount: &pb.SyncAccountUserInfoResponse_UnblockUserInAccountOperation{
			AccountName: accountName,
			UserId:      userId,
		},
	}
	result := &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: syncOperation,
		Success:       true,
	}
	return result
}
