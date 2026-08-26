package accountsync

import pb "scow-adapters/gen/go"

func CreateAccountFailedOperation(accountName, message string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	return &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: &pb.SyncAccountUserInfoResponse_SyncOperationResult_CreateAccount{
			CreateAccount: &pb.SyncAccountUserInfoResponse_CreateAccountOperation{AccountName: accountName},
		},
		Success:        false,
		FailureMessage: &message,
	}
}

func CreateAccountSuccessOperation(accountName string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	return &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: &pb.SyncAccountUserInfoResponse_SyncOperationResult_CreateAccount{
			CreateAccount: &pb.SyncAccountUserInfoResponse_CreateAccountOperation{AccountName: accountName},
		},
		Success: true,
	}
}

func BlockAccountFailedOperation(accountName, message string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	return &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: &pb.SyncAccountUserInfoResponse_SyncOperationResult_BlockAccount{
			BlockAccount: &pb.SyncAccountUserInfoResponse_BlockAccountOperation{AccountName: accountName},
		},
		Success:        false,
		FailureMessage: &message,
	}
}

func BlockAccountSuccessOperation(accountName string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	return &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: &pb.SyncAccountUserInfoResponse_SyncOperationResult_BlockAccount{
			BlockAccount: &pb.SyncAccountUserInfoResponse_BlockAccountOperation{AccountName: accountName},
		},
		Success: true,
	}
}

func UnblockAccountFailedOperation(accountName, message string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	return &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: &pb.SyncAccountUserInfoResponse_SyncOperationResult_UnblockAccount{
			UnblockAccount: &pb.SyncAccountUserInfoResponse_UnblockAccountOperation{AccountName: accountName},
		},
		Success:        false,
		FailureMessage: &message,
	}
}

func UnblockAccountSuccessOperation(accountName string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	return &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: &pb.SyncAccountUserInfoResponse_SyncOperationResult_UnblockAccount{
			UnblockAccount: &pb.SyncAccountUserInfoResponse_UnblockAccountOperation{AccountName: accountName},
		},
		Success: true,
	}
}

func AddUserToAccountFailedOperation(accountName, userID, message string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	return &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: &pb.SyncAccountUserInfoResponse_SyncOperationResult_AddUserToAccount{
			AddUserToAccount: &pb.SyncAccountUserInfoResponse_AddUserToAccountOperation{
				AccountName: accountName,
				UserId:      userID,
			},
		},
		Success:        false,
		FailureMessage: &message,
	}
}

func AddUserToAccountSuccessOperation(accountName, userID string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	return &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: &pb.SyncAccountUserInfoResponse_SyncOperationResult_AddUserToAccount{
			AddUserToAccount: &pb.SyncAccountUserInfoResponse_AddUserToAccountOperation{
				AccountName: accountName,
				UserId:      userID,
			},
		},
		Success: true,
	}
}

func RemoveUserFromAccountFailedOperation(accountName, userID, message string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	return &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: &pb.SyncAccountUserInfoResponse_SyncOperationResult_RemoveUserFromAccount{
			RemoveUserFromAccount: &pb.SyncAccountUserInfoResponse_RemoveUserFromAccountOperation{
				AccountName: accountName,
				UserId:      userID,
			},
		},
		Success:        false,
		FailureMessage: &message,
	}
}

func RemoveUserFromAccountSuccessOperation(accountName, userID string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	return &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: &pb.SyncAccountUserInfoResponse_SyncOperationResult_RemoveUserFromAccount{
			RemoveUserFromAccount: &pb.SyncAccountUserInfoResponse_RemoveUserFromAccountOperation{
				AccountName: accountName,
				UserId:      userID,
			},
		},
		Success: true,
	}
}

func BlockUserInAccountFailedOperation(accountName, userID, message string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	return &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: &pb.SyncAccountUserInfoResponse_SyncOperationResult_BlockUserInAccount{
			BlockUserInAccount: &pb.SyncAccountUserInfoResponse_BlockUserInAccountOperation{
				AccountName: accountName,
				UserId:      userID,
			},
		},
		Success:        false,
		FailureMessage: &message,
	}
}

func BlockUserInAccountSuccessOperation(accountName, userID string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	return &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: &pb.SyncAccountUserInfoResponse_SyncOperationResult_BlockUserInAccount{
			BlockUserInAccount: &pb.SyncAccountUserInfoResponse_BlockUserInAccountOperation{
				AccountName: accountName,
				UserId:      userID,
			},
		},
		Success: true,
	}
}

func UnblockUserInAccountFailedOperation(accountName, userID, message string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	return &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: &pb.SyncAccountUserInfoResponse_SyncOperationResult_UnblockUserInAccount{
			UnblockUserInAccount: &pb.SyncAccountUserInfoResponse_UnblockUserInAccountOperation{
				AccountName: accountName,
				UserId:      userID,
			},
		},
		Success:        false,
		FailureMessage: &message,
	}
}

func UnblockUserInAccountSuccessOperation(accountName, userID string) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	return &pb.SyncAccountUserInfoResponse_SyncOperationResult{
		SyncOperation: &pb.SyncAccountUserInfoResponse_SyncOperationResult_UnblockUserInAccount{
			UnblockUserInAccount: &pb.SyncAccountUserInfoResponse_UnblockUserInAccountOperation{
				AccountName: accountName,
				UserId:      userID,
			},
		},
		Success: true,
	}
}
