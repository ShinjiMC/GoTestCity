package server

import (
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
)

// insertComplexityNested inserta la función en el árbol de carpetas/archivos y acumula la complejidad
func insertComplexityNested(root map[string]interface{}, parts []string, funcName, line string, complexity int) {
	if len(parts) == 0 {
		return
	}
	key := parts[0]

	if len(parts) == 1 {
		// Último nivel: archivo
		if _, ok := root[key]; !ok {
			root[key] = map[string]interface{}{
				"complexity": 0,
				"functions":  []map[string]interface{}{},
			}
		}
		node := root[key].(map[string]interface{})
		node["complexity"] = node["complexity"].(int) + complexity
		funcs := node["functions"].([]map[string]interface{})
		node["functions"] = append(funcs, map[string]interface{}{
			"func":       funcName,
			"line":       line,
			"complexity": complexity,
		})
	} else {
		// Carpeta
		if _, ok := root[key]; !ok {
			root[key] = map[string]interface{}{
				"complexity": 0,
				"files":      map[string]interface{}{},
			}
		}
		node := root[key].(map[string]interface{})
		node["complexity"] = node["complexity"].(int) + complexity
		insertComplexityNested(node["files"].(map[string]interface{}), parts[1:], funcName, line, complexity)
	}
}

// RunComplexityAnalysis ejecuta gocyclo y guarda los resultados jerárquicamente
func RunComplexityAnalysis(repoPath string, doc map[string]interface{}) error {
	cmd := exec.Command("gocyclo", ".")
	cmd.Dir = repoPath
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("gocyclo error: %v\n%s", err, string(out))
	}

	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	re := regexp.MustCompile(`^\s*(\d+)\s+(\S+)\s+(\S+)\s+([^\s:]+):(\d+):(\d+)`)

	tree := make(map[string]interface{})
	totalComplexity := 0

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		m := re.FindStringSubmatch(line)
		if len(m) != 7 {
			continue
		}

		complexity, _ := strconv.Atoi(m[1])
		funcName := m[3]
		file := m[4]
		lineNum := m[5]

		totalComplexity += complexity

		// Dividir ruta en carpetas + archivo
		pathParts := strings.Split(file, "/")
		insertComplexityNested(tree, pathParts, funcName, lineNum, complexity)
	}

	doc["complexity"] = map[string]interface{}{
		"repoPath":         repoPath,
		"totalComplexity":  totalComplexity,
		"tree":             tree,
	}
	return nil
}
