package server

import (
	"encoding/json"
	"fmt"
	"math"
	"os/exec"
	"regexp"
)

// RunQualityAnalysis ejecuta golangci-lint v2.4.0, procesa el JSON
func RunQualityAnalysis(repoPath string, doc map[string]interface{}) error {
	cmd := exec.Command(
		"golangci-lint",
		"run",
		"--no-config",
		"--enable-only", "govet,staticcheck,errcheck",
		"--output.json.path", "stdout",
		"./...",
	)
	cmd.Dir = repoPath

	out, err := cmd.CombinedOutput()
	if err != nil && len(out) == 0 {
		return fmt.Errorf("golangci-lint error: %v\n%s", err, string(out))
	}

	// ⚡ Filtrar solo el bloque JSON válido
	// Captura desde { ... } ignorando el texto posterior como "0 issues."
	re := regexp.MustCompile(`(?s)\{.*\}`)
	jsonPart := re.Find(out)
	if jsonPart == nil {
		return fmt.Errorf("no se encontró un bloque JSON en la salida:\n%s", string(out))
	}

	var result struct {
		Issues []interface{} `json:"Issues"`
		Report interface{}   `json:"Report"`
	}
	if err := json.Unmarshal(jsonPart, &result); err != nil {
		return fmt.Errorf("error parsing golangci-lint JSON: %v\n%s", err, string(jsonPart))
	}

	issues := len(result.Issues)

	// Escala lineal: 100 puntos si 0 issues, decrece hasta 0 si ≥100 issues
	qualityScore := math.Max(0, 100.0-(float64(issues)/100.0*100.0))

	doc["quality"] = map[string]interface{}{
		"issuesCount":  issues,
		"qualityScore": qualityScore,
		"details": map[string]interface{}{
			"Issues": result.Issues,
			"Report": result.Report,
		},
	}
	return nil
}
