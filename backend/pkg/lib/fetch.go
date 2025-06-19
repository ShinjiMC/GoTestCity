package lib

import (
	"fmt"
	"os"

	log "github.com/sirupsen/logrus"
	"gopkg.in/src-d/go-git.v4"
	"gopkg.in/src-d/go-git.v4/plumbing"
)

type Fetcher interface {
	Fetch(packageName string, branchName string, commit string) (string, error)
}


func NewFetcher(tmpFolder string) Fetcher {
	return &fetcher{tmpFolder: tmpFolder}
}

type fetcher struct {
	tmpFolder string
}

func (f *fetcher) Fetch(name string, branch string, commit string) (string, error) {
	//print

	log.Infof("Commit recibido en Fetch: %s", commit)
	gitAddress := fmt.Sprintf("https://%s", name)
	folder := fmt.Sprintf("%s/%s", f.tmpFolder, name)
	log.Infof("fetch to %s (tmp: %s, name: %s)", folder, f.tmpFolder, name)

	var r *git.Repository
	var err error

	r, err = git.PlainClone(folder, false, &git.CloneOptions{
		URL:           gitAddress,
		SingleBranch:  true,
		ReferenceName: plumbing.ReferenceName(fmt.Sprintf("refs/heads/%s", branch)),
		Depth:         0,
	})

	// Si ya existe, abrirlo
	if err == git.ErrRepositoryAlreadyExists {
		r, err = git.PlainOpen(folder)
		if err != nil {
			log.Errorf("Error al abrir repo existente: %v", err)
			return "", err
		}
	} else if err != nil {
		// Otro error: limpiar y salir
		go func() {
			if err := os.RemoveAll(folder); err != nil {
				log.WithField("folder", folder).Error(err)
			}
		}()
		return "", err
	}

	// Checkout al commit si se especificó
	if commit != "" {
		w, err := r.Worktree()
		if err != nil {
			log.Errorf("Error al obtener Worktree: %v", err)
			return "", err
		}
		err = w.Checkout(&git.CheckoutOptions{
			Hash: plumbing.NewHash(commit),
		})
		if err != nil {
			log.Errorf("Error al hacer checkout al commit %s: %v", commit, err)
			return "", fmt.Errorf("failed to checkout commit: %w", err)
		}
	}

	return folder, nil
}
