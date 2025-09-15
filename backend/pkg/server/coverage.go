package server

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
)

// insertNested inserta cada función en la estructura jerárquica.
func insertNested(root map[string]interface{}, parts []string, funcName, line string, percent float64) {
	if len(parts) == 0 {
		return
	}
	key := parts[0]
	if len(parts) == 1 {
		if _, ok := root[key]; !ok {
			root[key] = map[string]interface{}{
				"functions": []map[string]interface{}{},
			}
		}
		fileNode := root[key].(map[string]interface{})
		funcs := fileNode["functions"].([]map[string]interface{})
		fileNode["functions"] = append(funcs, map[string]interface{}{
			"func":    funcName,
			"line":    line,
			"percent": percent,
		})
	} else {
		if _, ok := root[key]; !ok {
			root[key] = map[string]interface{}{}
		}
		insertNested(root[key].(map[string]interface{}), parts[1:], funcName, line, percent)
	}
}

// computeAverages recorre el árbol para calcular promedios en cada nivel.
func computeAverages(node interface{}) (float64, int) {
	switch n := node.(type) {
	case map[string]interface{}:
		var total float64
		var count int
		if funcsRaw, ok := n["functions"]; ok {
			funcs := funcsRaw.([]map[string]interface{})
			for _, f := range funcs {
				if p, ok := f["percent"].(float64); ok {
					total += p
					count++
				}
			}
		}
		for k, v := range n {
			if k == "functions" {
				continue
			}
			childTotal, childCount := computeAverages(v)
			total += childTotal
			count += childCount
		}
		if count > 0 {
			n["percent"] = total / float64(count)
		}
		return total, count
	}
	return 0, 0
}
func RunCoverageAndStore(repoPath string, doc map[string]interface{}) error {
	// Crear archivo temporal para la cobertura
	tmpFile, err := os.CreateTemp("", "coverage-*.out")
	if err != nil {
		return fmt.Errorf("cannot create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name()) // borrarlo al final

	// Ejecutar go-acc y escribir en archivo temporal
	accCmd := exec.Command("go-acc", "./...", "--covermode=count", "--output", tmpFile.Name())
	accCmd.Dir = repoPath
	if out, err := accCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("go-acc error: %v\n%s", err, string(out))
	}

	// go tool cover -func para obtener reporte legible
	coverCmd := exec.Command("go", "tool", "cover", "-func="+tmpFile.Name())
	coverCmd.Dir = repoPath
	coverReport, err := coverCmd.Output()
	if err != nil {
		return fmt.Errorf("go tool cover error: %v", err)
	}

	reportLines := strings.Split(strings.TrimSpace(string(coverReport)), "\n")
	reTotal := regexp.MustCompile(`total:\s+\(statements\)\s+([\d\.]+)%`)
	var totalPercent float64
	reportTree := make(map[string]interface{})

	for _, line := range reportLines {
		if matches := reTotal.FindStringSubmatch(line); len(matches) >= 2 {
			totalPercent, _ = strconv.ParseFloat(matches[1], 64)
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		percentStr := strings.TrimSuffix(fields[len(fields)-1], "%")
		percent, _ := strconv.ParseFloat(percentStr, 64)

		funcName := ""
		if len(fields) > 2 {
			funcName = fields[1]
		}
		filePart := fields[0]
		parts := strings.Split(filePart, ":")
		filePath := parts[0]
		lineNumber := ""
		if len(parts) > 1 {
			lineNumber = parts[1]
		}

		filePath = strings.TrimPrefix(filePath, "github.com/")
		filePath = strings.TrimPrefix(filePath, "sourcegraph/")
		pathParts := strings.Split(filePath, "/")

		insertNested(reportTree, pathParts, funcName, lineNumber, percent)
	}

	computeAverages(reportTree)

	// JSON detallado con gocov
	gocovCmd := exec.Command("gocov", "convert", tmpFile.Name())
	gocovCmd.Dir = repoPath
	jsonData, err := gocovCmd.Output()
	if err != nil {
		return fmt.Errorf("gocov error: %v", err)
	}

	var cov interface{}
	if err := json.Unmarshal(jsonData, &cov); err != nil {
		return fmt.Errorf("unmarshal error: %v", err)
	}

	doc["coverage"] = map[string]interface{}{
		"percent": totalPercent,
		//"details": cov,
		"report":  reportTree,
	}

	return nil
}
