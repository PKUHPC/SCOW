package auth

import "github.com/sirupsen/logrus"

// User represents a user account compatible with os/user.User
type User struct {
	UID      string // user ID
	GID      string // primary group ID
	Username string
	HomeDir  string
}

// Lookup looks up a user by username
func Lookup(username string) (*User, error) {
	userInfo, err := LookupUser(username)
	if err != nil {
		logrus.WithError(err).Errorf("lookup user %q", username)
		return nil, err
	}

	return &User{
		UID:      userInfo.UID,
		GID:      userInfo.GID,
		Username: userInfo.Username,
		HomeDir:  userInfo.HomeDir,
	}, nil
}

// LookupID looks up a user by user ID
func LookupID(uid string) (*User, error) {
	userInfo, err := LookupUserByID(uid)
	if err != nil {
		return nil, err
	}

	return &User{
		UID:      userInfo.UID,
		GID:      userInfo.GID,
		Username: userInfo.Username,
		HomeDir:  userInfo.HomeDir,
	}, nil
}

// GetUserHomeDir returns the home directory for a given username
func GetUserHomeDir(username string) (string, error) {
	user, err := Lookup(username)
	if err != nil {
		return "", err
	}
	return user.HomeDir, nil
}
