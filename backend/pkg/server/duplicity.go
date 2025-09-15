package server

import (
	"bufio"
	"fmt"
	"os/exec"
	"regexp"
	"strings"
)

// RunDuplicationAnalysis ejecuta dupl y guarda los resultados agrupados.
func RunDuplicationAnalysis(repoPath string, doc map[string]interface{}) error {
	cmd := exec.Command("dupl", "-t", "25", "./")
	cmd.Dir = repoPath

	out, err := cmd.CombinedOutput()
	if err != nil && len(out) == 0 {
		return fmt.Errorf("dupl error: %v\n%s", err, string(out))
	}

	rePair := regexp.MustCompile(`^(.+?):(\d+),(\d+)`)
	reHeader := regexp.MustCompile(`^found (\d+) clones:`)

	groups := []map[string]interface{}{}
	var currentGroup []map[string]interface{}

	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Nuevo bloque
		if m := reHeader.FindStringSubmatch(line); len(m) == 2 {
			// Si había un grupo previo, lo guardamos
			if len(currentGroup) > 0 {
				groups = append(groups, map[string]interface{}{
					"pairs": currentGroup,
				})
				currentGroup = nil
			}
			continue
		}

		// Par de archivos dentro del bloque
		if m := rePair.FindStringSubmatch(line); len(m) == 4 {
			currentGroup = append(currentGroup, map[string]interface{}{
				"file":  m[1],
				"start": m[2],
				"end":   m[3],
			})
		}
	}

	// Último grupo
	if len(currentGroup) > 0 {
		groups = append(groups, map[string]interface{}{
			"pairs": currentGroup,
		})
	}

	// Guardar en doc
	doc["duplication"] = map[string]interface{}{
		"groups":     groups,
		"totalPairs": countPairs(groups),
	}

	return nil
}

// countPairs calcula el total de pares en todos los grupos
func countPairs(groups []map[string]interface{}) int {
	total := 0
	for _, g := range groups {
		if pairs, ok := g["pairs"].([]map[string]interface{}); ok {
			total += len(pairs)
		}
	}
	return total
}
