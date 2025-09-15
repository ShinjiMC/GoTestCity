package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"os/exec"
	"sort"
	"strings"
	"time"

	"github.com/shinjimc/gotestcity/pkg/analyzer"
	"github.com/shinjimc/gotestcity/pkg/lib"
	"github.com/shinjimc/gotestcity/pkg/model"
	"github.com/shinjimc/gotestcity/pkg/server/middlewares"
	"go.mongodb.org/mongo-driver/mongo"

	"net/http/httputil"
	"net/url"

	"github.com/go-chi/chi"
	"github.com/go-chi/chi/middleware"
	log "github.com/sirupsen/logrus"
)

// //go:embed assets
// var assets embed.FS

// //go:embed assets/index.html
// var indexPage []byte

var ErrInvalidPath = fmt.Errorf("invalid path")

type AnalyzerHandle struct {
	Cache       lib.Cache
	CacheTTL    time.Duration
	TmpFolder   string
	Port        int
	ProjectPath *string
	Branch      *string
	Local       bool
    MongoClient *mongo.Client
}

type GitAnalyzer struct {
    Branch   string
    RepoPath string
}

func (g *GitAnalyzer) ListCommits() ([]string, error) {
    if g.Branch == "" {
        return nil, fmt.Errorf("branch no especificada")
    }

    cmd := exec.Command("git", "rev-list", "--first-parent", g.Branch)
    cmd.Dir = g.RepoPath
    out, err := cmd.Output()
    if err != nil {
        return nil, fmt.Errorf("git rev-list error: %v", err)
    }

    lines := bytes.Split(out, []byte("\n"))
    commits := make([]string, 0, len(lines))
    for _, l := range lines {
        c := strings.TrimSpace(string(l))
        if c != "" {
            commits = append(commits, c)
        }
    }
    return commits, nil
}


func (h *AnalyzerHandle) Handler(w http.ResponseWriter, r *http.Request) {
	var (
		ok             bool
		projectAddress string
	)

	if h.ProjectPath != nil {
		projectAddress = *h.ProjectPath
	}

	if q := r.URL.Query().Get("q"); q != "local" {
		projectAddress, ok = lib.GetGithubBaseURL(r.URL.Query().Get("q"))
		if !ok {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
	}

	branch := "master"
	if b := r.URL.Query().Get("b"); b != "" {
		branch = b
	} else if h.Branch != nil {
		branch = *h.Branch
	}

	commit := r.URL.Query().Get("c")
	log.Infof("Commit recibido: %s", commit)
	log.Infof("[Handler] Inicio Handler para proyecto: %s", projectAddress)
	log.Infof("[Handler] Branch: %s, Commit: %s", branch, commit)
	// codeAnalyzer := analyzer.NewAnalyzer(projectAddress, branch, "", h.TmpFolder, analyzer.WithIgnoreList("/vendor/"))
	// gitAnalyzer := &GitAnalyzer{
	// 	Branch:   branch,
	// 	RepoPath: projectAddress,
	// }

	// --- Procesar todos los commits y guardarlos en MongoDB ---
	if h.MongoClient != nil {
		log.Infof("[Handler] MongoDB habilitado, listando commits")
		// commits, err := gitAnalyzer.ListCommits()
		// if err != nil {
		// 	log.Warnf("Error listando commits de la rama %s: %v", branch, err)
		// } else {
		// 	for _, c := range commits {
		// 		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		// 		coll := h.MongoClient.Database("gocity_metrics").Collection("commits")
		// 		var existing bson.M
		// 		err := coll.FindOne(ctx, bson.M{"repo": projectAddress, "branch": branch, "commit": c}).Decode(&existing)
		// 		cancel()
		// 		if err == nil {
		// 			log.Infof("Commit %s ya analizado, omitiendo.", c)
		// 			continue
		// 		}

		// 		// path := projectAddress
		// 		// stat, err := os.Stat("/tmp/"+projectAddress)
		// 		// if os.IsNotExist(err) {
		// 		// 	path, err = codeAnalyzer.FetchPackage()
		// 		// 	if err != nil {
		// 		// 		log.Warnf("Error fetch package para commit %s: %v", c, err)
		// 		// 		continue
		// 		// 	}
		// 		// } else if !stat.IsDir() {
		// 		// 	log.Warnf("Ruta inválida: %s", projectAddress)
		// 		// 	continue
		// 		// }

		// 		// if err := AnalyzeCommit(path, branch, c, h.MongoClient); err != nil {
		// 		// 	log.Warnf("Commit %s analysis failed: %v", c, err)
		// 		// } else {
		// 		// 	log.Infof("Commit %s analizado correctamente.", c)
		// 		// }
		// 	}
		// }
	}

	log.Infof("[Handler] Creando Analyzer para path: %s", projectAddress)
	// --- Generar JSON y cache para el commit específico ---
	key := fmt.Sprintf("%s:%s:%s", projectAddress, branch, commit)
	
	result, err := h.Cache.GetSet(key, func() ([]byte, error) {
		log.Infof("Fetching project: %s, branch: %s, commit: %s", projectAddress, branch, commit)
		codeAnalyzer := analyzer.NewAnalyzer(
			projectAddress,
			branch,
			commit,
			h.TmpFolder,
			analyzer.WithIgnoreList("/vendor/", "/test/", "/staging/", "/_output/", "/hack/"),
		)
		//codeAnalyzer := analyzer.NewAnalyzer(projectAddress, branch, h.TmpFolder, analyzer.WithIgnoreList("/vendor/"))

		path := projectAddress
		log.Infof("[Handler] Analizando paquete local/fetch: %s", path)
		stat, err := os.Stat(projectAddress)
		if os.IsNotExist(err) {
			path, err = codeAnalyzer.FetchPackage()
			if err != nil {
				return nil, err
			}
		} else if !stat.IsDir() {
			return nil, ErrInvalidPath
		}

		// if h.MongoClient != nil {
		// 	if err := AnalyzeCommit(path, branch, commit, h.MongoClient); err != nil {
		// 		log.Warnf("Commit analysis failed: %v", err)
		// 	}
		// }
		log.Infof("Analizando paquete: %s", path)
		summary, err := codeAnalyzer.Analyze(path)
		log.Infof("[Handler] Análisis completado para commit: %s", commit)
		if err != nil {
			log.Errorf("Error analizando %s: %v", path, err)
			return nil, err
		}

		body, err := json.Marshal(model.New(summary, projectAddress, branch))
		if err != nil {
			return nil, err
		}

		return body, nil
	}, h.CacheTTL)

	if err == ErrInvalidPath {
		w.WriteHeader(http.StatusBadRequest)
		log.Print(err)
	} else if err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		log.Print(err)
		return
	}

	if len(result) == 0 {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write(result)
	if err != nil {
		log.Error(err)
	}
}



func findNodeByURL(node map[string]interface{}, url string) map[string]interface{} {
	if node == nil {
		return nil
	}

	nodeURL, ok := node["url"].(string)
	if ok && nodeURL == url {
		copyNode := make(map[string]interface{})
		for k, v := range node {
			copyNode[k] = v
		}

		if childrenIface, ok := copyNode["children"]; ok && childrenIface != nil {
			children, ok := childrenIface.([]interface{})
			if ok {
				newChildren := []map[string]interface{}{}
				for _, c := range children {
					cmap, ok := c.(map[string]interface{})
					if !ok {
						continue
					}
					childCopy := make(map[string]interface{})
					for k, v := range cmap {
						if k != "children" {
							childCopy[k] = v
						}
					}

					// Procesar hijos de hijos
					if subChildrenIface, ok := cmap["children"]; ok && subChildrenIface != nil {
						subChildren, ok := subChildrenIface.([]interface{})
						if ok {
							onlyFiles := true
							subCopy := []map[string]interface{}{}
							for _, sc := range subChildren {
								scMap, ok := sc.(map[string]interface{})
								if !ok {
									continue
								}
								typ, _ := scMap["type"].(string)
								if typ == "PACKAGE" {
									onlyFiles = false
								}
								subCopy = append(subCopy, scMap)
							}

							if onlyFiles {
								childCopy["children"] = subCopy
							} else {
								childCopy["height"] = len(subCopy)
							}
						}
					}

					newChildren = append(newChildren, childCopy)
				}
				copyNode["children"] = newChildren
			}
		}
		return copyNode
	}

	// Buscar recursivamente en los hijos
	if childrenIface, ok := node["children"]; ok && childrenIface != nil {
		children, ok := childrenIface.([]interface{})
		if ok {
			for _, c := range children {
				cmap, ok := c.(map[string]interface{})
				if !ok {
					continue
				}
				if found := findNodeByURL(cmap, url); found != nil {
					return found
				}
			}
		}
	}
	return nil
}


func nodeWidth(n map[string]interface{}) float64 {
	if w, ok := n["width"].(float64); ok {
		return w
	}
	return 1
}

func nodeDepth(n map[string]interface{}) float64 {
	if d, ok := n["depth"].(float64); ok {
		return d
	}
	return 1
}

func nodeArea(n map[string]interface{}) float64 {
	return nodeWidth(n) * nodeDepth(n)
}


// Redimensiona y posiciona packages en cuadrados con altura proporcional
func rescalePackages(packages []map[string]interface{}, padding float64) (float64, float64) {
	if len(packages) == 0 {
		return 0, 0
	}

	maxArea := 0.0
	for _, p := range packages {
		area := nodeWidth(p) * nodeDepth(p)
		if area > maxArea {
			maxArea = area
		}
	}
	scaleFactor := 0.3
	for _, p := range packages {
		side := math.Sqrt(maxArea) * scaleFactor
		origW := nodeWidth(p)
		origD := nodeDepth(p)
		p["width"] = side
		p["depth"] = side
		p["height"] = nodeArea(p)/maxArea*math.Max(origW, origD)
	}

	// Ordenar de grande a pequeño según altura
	sort.Slice(packages, func(i, j int) bool {
		return packages[i]["height"].(float64) > packages[j]["height"].(float64)
	})

	// Calcular cuadrícula NxN automáticamente
	n := len(packages)
	gridCols := int(math.Ceil(math.Sqrt(float64(n))))

	// Agregar 10% del tamaño del package al padding
	packageSize := nodeWidth(packages[0])
	extraPad := 0.1 * packageSize
	totalPad := padding + extraPad

	xStart := -float64(gridCols-1)*(packageSize+totalPad)/2
	yStart := -float64(gridCols-1)*(packageSize+totalPad)/2

	for i, p := range packages {
		col := i % gridCols
		row := i / gridCols
		x := xStart + float64(col)*(packageSize+totalPad)
		y := yStart + float64(row)*(packageSize+totalPad)

		p["position"] = map[string]interface{}{"x": x, "y": y}
	}

	totalW := float64(gridCols)*(packageSize+totalPad) - totalPad
	totalH := float64(gridCols)*(packageSize+totalPad) - totalPad

	return totalW, totalH
}

// Convoca a packages y luego a files/structs
func rescaleChildren(parent map[string]interface{}, padding float64) (float64, float64) {
	raw, ok := parent["children"]
	if !ok || raw == nil {
		w, d := nodeWidth(parent), nodeDepth(parent)
		parent["width"] = math.Max(w, 100)
		parent["depth"] = math.Max(d, 100)
		return parent["width"].(float64), parent["depth"].(float64)
	}

	var children []map[string]interface{}
	switch t := raw.(type) {
	case []map[string]interface{}:
		children = t
	case []interface{}:
		for _, ci := range t {
			if m, ok := ci.(map[string]interface{}); ok {
				children = append(children, m)
			}
		}
	}

	if len(children) == 0 {
		w, d := nodeWidth(parent), nodeDepth(parent)
		parent["width"] = math.Max(w, 100)
		parent["depth"] = math.Max(d, 100)
		return parent["width"].(float64), parent["depth"].(float64)
	}

	// Separar packages de hijos
	var packages []map[string]interface{}
	for _, ch := range children {
		if t, _ := ch["type"].(string); t == "PACKAGE" {
			packages = append(packages, ch)
		}
	}

	// Escalar packages en el parent
	pw, ph := rescalePackages(packages, padding)

	// --- NUEVO: calcular tamaño real del parent ---
	minX, maxX := 1e9, -1e9
	minY, maxY := 1e9, -1e9
	for _, ch := range children {
		pos := ch["position"].(map[string]interface{})
		w := nodeWidth(ch)
		d := nodeDepth(ch)
		x := pos["x"].(float64)
		y := pos["y"].(float64)
		minX = math.Min(minX, x-w/2)
		maxX = math.Max(maxX, x+w/2)
		minY = math.Min(minY, y-d/2)
		maxY = math.Max(maxY, y+d/2)
	}

	totalW := maxX - minX
	totalH := maxY - minY

	parent["width"] = math.Max(math.Max(totalW, pw), 100)
	parent["depth"] = math.Max(math.Max(totalH, ph), 100)

	return parent["width"].(float64), parent["depth"].(float64)
}

func rescaleRootChildrenOrdered(root map[string]interface{}) {
	raw, ok := root["children"]
	if !ok || raw == nil {
		return
	}

	var children []map[string]interface{}
	switch t := raw.(type) {
	case []map[string]interface{}:
		children = t
	case []interface{}:
		for _, ci := range t {
			if m, ok := ci.(map[string]interface{}); ok {
				children = append(children, m)
			}
		}
	}

	if len(children) == 0 {
		root["width"] = 100.0
		root["depth"] = 100.0
		return
	}

	// Separar packages y files
	var packages, files, structs []map[string]interface{}
	minPackageHeight := 1e9
	maxPackageWidth := 0.0
	for _, ch := range children {
		tp, _ := ch["type"].(string)
		height := 0.0
		if h, ok := ch["height"].(float64); ok {
			height = h
		}
		side := math.Max(nodeWidth(ch), nodeDepth(ch))

		if tp == "PACKAGE" {
			packages = append(packages, ch)
			if height < minPackageHeight {
				minPackageHeight = height
			}
			if side > maxPackageWidth {
				maxPackageWidth = side
			}
		} else if tp == "STRUCT" {
			structs = append(structs, ch)
			// Asignar height según numberOfAttributes
			numAttr, _ := ch["numberOfAttributes"].(float64)
			if numAttr > 0 {
				ch["height"] = numAttr * 10
			} else {
				ch["height"] = 1
			}
		} else {
			files = append(files, ch)
		}
	}

	if minPackageHeight == 1e9 || math.IsNaN(minPackageHeight) {
		minPackageHeight = 10.0 // fallback si no hay packages
	}
	if maxPackageWidth <= 0 || math.IsNaN(maxPackageWidth) {
		maxPackageWidth = 10.0
	}

	// Redimensionar files
	for _, f := range files {
		size := maxPackageWidth
		f["height"] = 0.5 * minPackageHeight
		f["width"] = size
		f["depth"] = size
		rescaleStructsInFileCenter(f)
	}

	// Combinar todos y ordenar
	all := append(packages, files...)
	all = append(all, structs...)
	sort.Slice(all, func(i, j int) bool {
		h1, _ := all[i]["height"].(float64)
		h2, _ := all[j]["height"].(float64)
		return h1 > h2
	})

	// Padding
	padding := maxPackageWidth * 0.1
	n := len(all)
	gridCols := int(math.Ceil(math.Sqrt(float64(n))))
	gridRows := int(math.Ceil(float64(n) / float64(gridCols)))

	// Tamaño máximo de celda
	maxSide := 0.0
	for _, ch := range all {
		side := math.Max(nodeWidth(ch), nodeDepth(ch))
		if side > maxSide {
			maxSide = side
		}
	}
	cellSize := maxSide

	// Posicionar elementos
	xStart := -float64(gridCols-1) * (cellSize + padding) / 2
	yStart := float64(gridRows-1) * (cellSize + padding) / 2

	for i, ch := range all {
		col := i % gridCols
		row := i / gridCols
		x := xStart + float64(col)*(cellSize+padding)
		y := yStart - float64(row)*(cellSize+padding)

		// if math.IsNaN(x) || math.IsNaN(y) {
		// 	log.Warnf("[rescaleRootChildrenOrdered] NaN detected en position de '%s' x=%v y=%v", ch["name"], x, y)
		// }

		ch["position"] = map[string]interface{}{"x": x, "y": y}
		ch["width"] = cellSize
		ch["depth"] = cellSize

		if tp, _ := ch["type"].(string); tp != "PACKAGE" {
			rescaleStructsInFileCenter(ch)
		}
	}

	// Ajuste root
	totalW := float64(gridCols)*(cellSize+padding) - padding
	totalH := float64(gridRows)*(cellSize+padding) - padding
	size := math.Max(totalW, totalH)
	if size < 100 {
		scale := 100 / size
		size = 100

		for _, ch := range all {
			pos := ch["position"].(map[string]interface{})
			newX := pos["x"].(float64) * scale
			newY := pos["y"].(float64) * scale
			ch["position"] = map[string]interface{}{"x": newX, "y": newY}
			ch["width"] = nodeWidth(ch) * scale
			ch["depth"] = nodeDepth(ch) * scale
		}
	}

	root["width"] = size
	root["depth"] = size
	root["position"] = map[string]interface{}{"x": 0.0, "y": 0.0}

}


func rescaleStructsInFileCenter(file map[string]interface{}) {
	raw, ok := file["children"]
	if !ok || raw == nil {
		return
	}

	var structs []map[string]interface{}
	switch t := raw.(type) {
	case []map[string]interface{}:
		structs = t
	case []interface{}:
		for _, ci := range t {
			if m, ok := ci.(map[string]interface{}); ok {
				structs = append(structs, m)
			}
		}
	}

	if len(structs) == 0 {
		return
	}

	for _, s := range structs {
		numAttr, _ := s["numberOfAttributes"].(float64)
		if numAttr > 0 {
			s["height"] = numAttr * 10 // cada atributo 10 unidades de alto
		} else {
			s["height"] = 1 // valor mínimo
		}
	}

	// Ordenar structs de mayor a menor altura
	sort.Slice(structs, func(i, j int) bool {
		h1, _ := structs[i]["height"].(float64)
		h2, _ := structs[j]["height"].(float64)
		return h1 > h2
	})

	// Determinar width/depth del FILE
	fileWidth := nodeWidth(file)
	fileDepth := nodeDepth(file)
	padding := 0.05 * fileWidth // espacio entre structs
	marginFactor := 0.95       // aumentar margen para usar más espacio

	// Calcular cuadrícula NxN
	n := len(structs)
	gridCols := int(math.Ceil(math.Sqrt(float64(n))))
	gridRows := int(math.Ceil(float64(n) / float64(gridCols)))

	// Tamaño máximo por celda considerando padding y margen
	cellWidth := marginFactor * (fileWidth - padding*float64(gridCols-1)) / float64(gridCols)
	cellDepth := marginFactor * (fileDepth - padding*float64(gridRows-1)) / float64(gridRows)
	cellSize := math.Min(cellWidth, cellDepth)

	// Centro relativo del FILE
	centerX, centerY := 0.0, 0.0

	// Ajustar inicio para centrar la cuadrícula
	xStart := centerX - (float64(gridCols)-1)/2*(cellSize+padding)
	yStart := centerY + (float64(gridRows)-1)/2*(cellSize+padding)

	// Posicionar structs
	for i, s := range structs {
		col := i % gridCols
		row := i / gridCols
		x := xStart + float64(col)*(cellSize+padding)
		y := yStart - float64(row)*(cellSize+padding)

		s["position"] = map[string]interface{}{"x": x, "y": y}
		s["width"] = cellSize
		s["depth"] = cellSize
		// height se mantiene original
		if tp, _ := s["type"].(string); tp == "FILE" {
			rescaleStructsInFileCenter(s)
		}
	}
}



func rescaleFilesInPackage(packages []map[string]interface{}) {
	for _, pkg := range packages {
		raw, ok := pkg["children"]
		if !ok || raw == nil {
			continue
		}

		var files []map[string]interface{}
		switch t := raw.(type) {
		case []map[string]interface{}:
			files = t
		case []interface{}:
			for _, ci := range t {
				if m, ok := ci.(map[string]interface{}); ok {
					files = append(files, m)
				}
			}
		}

		if len(files) == 0 {
			continue
		}

		// Determinar width/depth del package
		pkgWidth := nodeWidth(pkg)
		pkgDepth := nodeDepth(pkg)
		padding := 0.1 * pkgWidth
		marginFactor := 0.9 // margen para que no tape al padre

		// Calcular cuadrícula NxN
		n := len(files)
		gridCols := int(math.Ceil(math.Sqrt(float64(n))))
		gridRows := int(math.Ceil(float64(n) / float64(gridCols)))

		// Tamaño máximo por celda con margen
		cellWidth := marginFactor * (pkgWidth - padding*float64(gridCols-1)) / float64(gridCols)
		cellDepth := marginFactor * (pkgDepth - padding*float64(gridRows-1)) / float64(gridRows)
		cellSize := math.Min(cellWidth, cellDepth)

		// Coordenadas relativas: 0,0 = centro del package
		centerX, centerY := 0.0, 0.0

		// Ajustar inicio para que la cuadrícula quede centrada dentro del package
		xStart := centerX - (float64(gridCols)/2*cellSize + float64(gridCols-1)/2*padding) + cellSize/2
		yStart := centerY + (float64(gridRows)/2*cellSize + float64(gridRows-1)/2*padding) - cellSize/2

		// Posicionar files relativos al centro del package
		for i, f := range files {
			col := i % gridCols
			row := i / gridCols
			x := xStart + float64(col)*(cellSize+padding)
			y := yStart - float64(row)*(cellSize+padding)

			f["position"] = map[string]interface{}{"x": x, "y": y}
			f["width"] = cellSize
			f["depth"] = cellSize

			// Reescalar structs dentro del FILE con margen
			rescaleStructsInFileCenter(f)
		}

		// NOTA: No modificamos pkg["width"] ni pkg["depth"]
	}
}


func rescaleTree(root map[string]interface{}) {
	if root == nil {
		return
	}
	root["position"] = map[string]interface{}{"x": 0.0, "y": 0.0}
	root["type"] = "ROOT"
	padding := 20.0 // aumentar espacio general
	rescaleChildren(root, padding)
	rescaleRootChildrenOrdered(root)

	// Extraer packages para reescalar sus files internos
	raw, ok := root["children"]
	if !ok || raw == nil {
		return
	}

	var packages []map[string]interface{}
	switch t := raw.(type) {
	case []map[string]interface{}:
		for _, ch := range t {
			if tp, _ := ch["type"].(string); tp == "PACKAGE" {
				packages = append(packages, ch)
			}
		}
	case []interface{}:
		for _, ci := range t {
			if m, ok := ci.(map[string]interface{}); ok {
				if tp, _ := m["type"].(string); tp == "PACKAGE" {
					packages = append(packages, m)
				}
			}
		}
	}
	
	rescaleFilesInPackage(packages)
}

func (h *AnalyzerHandle) HandlerHierarchical(w http.ResponseWriter, r *http.Request) {
	log.Infof("[HandlerHierarchical] Inicio HandlerHierarchical")
	// Obtener parámetros q, branch, commit
	q := r.URL.Query().Get("q")
	branch := r.URL.Query().Get("b")
	commit := r.URL.Query().Get("c")

	// Obtener key como parte de la ruta (chi URLParam)
	key := r.URL.Query().Get("key") // captura todo lo que venga después de /api/hierarchical/

	log.Infof("Parámetros recibidos - q: %s, branch: %s, commit: %s, key: %s", q, branch, commit, key)

	// Determinar projectAddress
	var projectAddress string
	var ok bool
	if q == "local" {
		if h.ProjectPath != nil {
			projectAddress = *h.ProjectPath
		} else {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
	} else {
		projectAddress, ok = lib.GetGithubBaseURL(q)
		if !ok {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
	}

	if branch == "" && h.Branch != nil {
		branch = *h.Branch
	}
	if branch == "" {
		branch = "master"
	}

	// Obtener JSON del cache
	cacheKey := fmt.Sprintf("%s:%s:%s", projectAddress, branch, commit)
	log.Infof("Parámetros procesados - q: %s, branch: %s, commit: %s, key: %s", projectAddress, branch, commit, key)
	fullJSON, err := h.Cache.GetSet(cacheKey, func() ([]byte, error) {
		codeAnalyzer := analyzer.NewAnalyzer(
			projectAddress,
			branch,
			commit,
			h.TmpFolder,
			analyzer.WithIgnoreList("/vendor/", "/test/"),
		)
		summary, err := codeAnalyzer.Analyze(projectAddress)
		if err != nil {
			return nil, err
		}
		return json.Marshal(summary)
	}, h.CacheTTL)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	var root map[string]interface{}
	if err := json.Unmarshal(fullJSON, &root); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	// Si key está vacío, usar root
	var target map[string]interface{}
	if key == "" {
		target = root
	} else {
		// Buscar nodo exacto por nombre
		log.Infof("Buscando nodo por URL: %s", key)
		target = findNodeByURL(root, key)
		if target == nil {
			w.WriteHeader(http.StatusNotFound)
			log.Infof("[HandlerHierarchical] Nodo no encontrado por URL: %s", key)
			return
		}
	}

	rescaleTree(target)
	resp, _ := json.Marshal(target)
	w.Header().Set("Content-Type", "application/json")
	w.Write(resp)
}



func (h *AnalyzerHandle) Serve() error {
	router := chi.NewRouter()
	cors := middlewares.GetCors("*")
	baseURL := fmt.Sprintf("http://localhost:%d", h.Port)

	router.Use(cors.Handler)
	router.Use(middlewares.APIHeader(fmt.Sprintf("%s/api", baseURL)))
	router.Use(middleware.DefaultLogger)

	router.Get("/api", h.Handler)
	router.Get("/api/hierarchical", h.HandlerHierarchical)

	router.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	frontendURL, err := url.Parse("http://localhost:8080") // React dev server
	if err != nil {
		log.Fatalf("Error parseando frontend URL: %v", err)
	}
	frontendProxy := httputil.NewSingleHostReverseProxy(frontendURL)
	router.NotFound(func(w http.ResponseWriter, r *http.Request) {
		frontendProxy.ServeHTTP(w, r)
	})
	// Todo lo demás (/) se va al proxy
	// router.Handle("/*", frontendProxy)

	// router.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
	// 	w.WriteHeader(200)
	// 	_, err := w.Write(indexPage)
	// 	if err != nil {
	// 		log.Error(err)
	// 	}
	// })

	// var staticFS = fs.FS(assets)
	// content, err := fs.Sub(staticFS, "assets")
	// if err != nil {
	// 	log.Fatal(err)
	// }
	// router.Handle("/*", http.FileServer(http.FS(content)))

	if h.Local {
		log.Infof("Visualization available at: %s/#/local", baseURL)
	} else if h.ProjectPath != nil {
		log.Infof("Visualization available at: %s/#/%s", baseURL, *h.ProjectPath)
	} else {
		log.Infof("Server started at %s", baseURL)
	}

	return http.ListenAndServe(fmt.Sprintf(":%d", h.Port), router)
}

