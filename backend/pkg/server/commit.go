// commit.go
package server

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// AnalyzeCommit ejecuta todos los análisis de un commit y lo guarda en MongoDB
func AnalyzeCommit(repoPath, branch, commit string, mongoClient *mongo.Client) error {
	if mongoClient == nil {
		return fmt.Errorf("mongo client is nil")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Minute)
	defer cancel()

	coll := mongoClient.Database("gocity_metrics").Collection("commits")

	// Verificar si ya existe este commit
	filter := bson.M{"repo": repoPath, "branch": branch, "commit": commit}
	var existing bson.M
	err := coll.FindOne(ctx, filter).Decode(&existing)
	if err == nil {
		log.Printf("Commit %s/%s/%s ya analizado, omitiendo.", repoPath, branch, commit)
		return nil
	}

	// Documento inicial
	doc := bson.M{
		"repo":    repoPath,
		"branch":  branch,
		"commit":  commit,
		"created": time.Now(),
	}

	// Ejecutar análisis y almacenar resultados en el mismo documento
	if err := RunCoverageAndStore(repoPath, doc); err != nil {
		log.Printf("Coverage analysis failed: %v", err)
	}

	if err := RunComplexityAnalysis(repoPath, doc); err != nil {
		log.Printf("Complexity analysis failed: %v", err)
	}

	if err := RunQualityAnalysis(repoPath, doc); err != nil {
		log.Printf("Quality analysis failed: %v", err)
	}

	if err := RunSecurityAnalysis(repoPath, doc); err != nil {
		log.Printf("Security analysis failed: %v", err)
	}

	if err := RunDuplicationAnalysis(repoPath, doc); err != nil {
		log.Printf("Duplication analysis failed: %v", err)
	}

	// Insertar el documento completo en MongoDB
	_, err = coll.InsertOne(ctx, doc)
	if err != nil {
		return fmt.Errorf("failed to insert commit analysis: %v", err)
	}

	log.Printf("Commit %s/%s/%s analizado y almacenado correctamente.", repoPath, branch, commit)
	return nil
}
