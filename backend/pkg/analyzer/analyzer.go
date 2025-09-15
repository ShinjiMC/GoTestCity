package analyzer

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"

	"github.com/shinjimc/gotestcity/pkg/lib"
	log "github.com/sirupsen/logrus"
)

type Analyzer interface {
	FetchPackage() (string, error)
	Analyze(path string) (map[string]*NodeInfo, error)
}

type analyzer struct {
	PackageName string
	BranchName  string
	CommitSHA   string
	IgnoreNodes []string
	fetcher     lib.Fetcher
	tmpFolder   string
}

type Option func(a *analyzer)

func NewAnalyzer(packageName, branchName, commitHash, tmpFolder string, options ...Option) Analyzer {
	log.Infof("Creating analyzer for package: %s, branch: %s, commit: %s", packageName, branchName, commitHash)
	analyzer := &analyzer{
		PackageName: packageName,
		BranchName:  branchName,
		CommitSHA:  commitHash,
		fetcher:     lib.NewFetcher(tmpFolder),
		tmpFolder:   tmpFolder,
	}

	for _, option := range options {
		option(analyzer)
	}

	return analyzer
}

// func NewAnalyzer(packageName, branchName, tmpFolder string, options ...Option) Analyzer {
// 	analyzer := &analyzer{
// 		PackageName: packageName,
// 		BranchName:  branchName,
// 		fetcher:     lib.NewFetcher(tmpFolder),
// 		tmpFolder:   tmpFolder,
// 	}

// 	for _, option := range options {
// 		option(analyzer)
// 	}

// 	return analyzer
// }

func WithIgnoreList(files ...string) Option {
	return func(a *analyzer) {
		a.IgnoreNodes = files
	}
}

func (a *analyzer) FetchPackage() (string, error) {
	return a.fetcher.Fetch(a.PackageName, a.BranchName, a.CommitSHA)
}

func (a *analyzer) IsInvalidPath(path string) bool {
	for _, value := range a.IgnoreNodes {
		return strings.Contains(path, value)
	}
	return false
}

func (a *analyzer) Analyze(path string) (map[string]*NodeInfo, error) {
	// log.Infof("[Analyze] Iniciando análisis en: %s", path)

	summary := make(map[string]*NodeInfo)
	fileCount := 0

	err := filepath.Walk(path, func(path string, f os.FileInfo, err error) error {
		if err != nil {
			log.Errorf("[Analyze] Error walking file: %s", err)
			return err
		}

		if f.IsDir() || !lib.IsGoFile(f.Name()) || a.IsInvalidPath(path) {
			return nil
		}

		fileCount++
		// log.Infof("[Analyze] Procesando archivo #%d: %s", fileCount, path)

		fileSet := token.NewFileSet()
		fileNode, err := parser.ParseFile(fileSet, path, nil, parser.ParseComments)
		if err != nil {
			log.Warnf("[Analyze] Error parseando archivo %s: %v", path, err)
			return nil
		}

		v := &Visitor{
			FileSet:     fileSet,
			PackageName: a.PackageName,
			Path:        path,
			StructInfo:  summary,
			TmpFolder:   a.tmpFolder,
		}
		ast.Walk(v, fileNode)
		return nil
	})

	// log.Infof("[Analyze] Archivos analizados: %d", fileCount)
	if err != nil {
		log.Errorf("[Analyze] Error final del análisis: %v", err)
	}

	return summary, err
}

