package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"os/exec"
	"time"
)

// RunSecurityAnalysis ejecuta gosec sobre el repositorio indicado
func RunSecurityAnalysis(repoPath string, doc map[string]interface{}) error {
	// Ejecutar gosec en formato JSON (quiet suprime logs)
	cmd := exec.Command("gosec", "-quiet", "-fmt", "json", "./...")
	cmd.Dir = repoPath
	out, err := cmd.CombinedOutput()

	// Si gosec falla y no produce salida, retorna el error
	if err != nil && len(out) == 0 {
		return fmt.Errorf("gosec error: %v", err)
	}

	// Si la salida está vacía, significa que no hubo análisis ni JSON
	if len(out) == 0 {
		doc["security"] = map[string]interface{}{
			"issuesCount":   0,
			"securityScore": 100,
			"details":       nil,
			"created":       time.Now(),
		}
		return nil
	}

	// Si por alguna razón aparecen logs antes del JSON, cortar desde la primera llave
	raw := out
	if idx := bytes.IndexByte(out, '{'); idx != -1 {
		raw = out[idx:]
	}

	var result map[string]interface{}
	if err := json.Unmarshal(raw, &result); err != nil {
		return fmt.Errorf("error parseando gosec JSON: %v\nSalida:\n%s", err, string(out))
	}

	issues := 0
	if arr, ok := result["Issues"].([]interface{}); ok {
		issues = len(arr)
	}

	// Puntuación simple (100 sin issues, decrece hasta 0 con ≥100)
	securityScore := math.Max(0, 100.0-(float64(issues)/100.0*100.0))

	doc["security"] = map[string]interface{}{
		"issuesCount":   issues,
		"securityScore": securityScore,
		"details":       result,
	}

	return nil
}
