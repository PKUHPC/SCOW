package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/spf13/cobra"
)

var profileCmd = &cobra.Command{
	Use:   "profile",
	Short: "Manage scowctl profiles",
}

var profileShowCmd = &cobra.Command{
	Use:   "show",
	Short: "Show current profile",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		return runProfileShow(os.Stdout)
	},
}

type profileShowOutput struct {
	Name          string `json:"name"`
	BaseURL       string `json:"baseUrl"`
	IdentityID    string `json:"identityId"`
	AuthType      string `json:"authType"`
	AuthUser      string `json:"authUser,omitempty"`
	AuthSecretSet bool   `json:"authSecretSet,omitempty"`
	OpenAPICache  string `json:"openapiCache,omitempty"`
}

func init() {
	profileCmd.AddCommand(profileShowCmd)
}

func runProfileShow(output io.Writer) error {
	current, err := getCurrentProfile()
	if err != nil {
		return err
	}

	result := profileShowOutput{
		Name:         current.Name,
		BaseURL:      current.BaseURL,
		IdentityID:   current.IdentityID,
		AuthType:     "token",
		OpenAPICache: current.OpenAPICache,
	}

	if current.AuthSecret != "" {
		result.AuthType = "static"
		result.AuthUser = current.AuthUser
		result.AuthSecretSet = true
	}

	content, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal profile: %w", err)
	}
	content = append(content, '\n')

	_, err = output.Write(content)
	return err
}
