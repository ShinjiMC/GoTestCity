package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/shinjimc/gotestcity/pkg/lib"
	"github.com/shinjimc/gotestcity/pkg/server"
	log "github.com/sirupsen/logrus"
	"github.com/urfave/cli/v2"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	defaultPort = 4000
	MONGO_URI="mongodb://mongo:FDQCHbYyvKQeWYqUOpbVRlQzxSKkcYJg@gondola.proxy.rlwy.net:53028"
)

func connectMongo(uri string) (*mongo.Client, context.Context, context.CancelFunc, error) {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
    if err != nil {
        cancel()
        return nil, nil, nil, fmt.Errorf("mongo connect: %w", err)
    }
    return client, ctx, cancel, nil
}

func main() {
	log.SetLevel(log.InfoLevel)

	app := cli.NewApp()

	app.Version = "1.0.6"
	app.Description = "Code City metaphor for visualizing Go source code in 3D"
	app.Copyright = "Braulio Maldonado (https://github.com/ShinjiMC)"

	app.Commands = []*cli.Command{
		{
			Name:        "server",
			Description: "Start a local server to analyze projects",
			Flags: []cli.Flag{
				&cli.IntFlag{
					Name:    "port",
					Aliases: []string{"b"},
					Value:   defaultPort,
					Usage:   "Local server port",
					EnvVars: []string{"PORT"},
				},
				&cli.DurationFlag{
					Name:    "cache",
					Aliases: []string{"c"},
					Value:   time.Hour,
					Usage:   "Cache's, TTL e.g.: --cache 4h",
					EnvVars: []string{"CACHE_TTL"},
				},
			},
            Action: func(c *cli.Context) error {
                client, _, cancel, err := connectMongo(MONGO_URI)	
                if err != nil {
                    return err
                }
                defer cancel()

                analyzer := server.AnalyzerHandle{
                    Cache:       lib.NewCache(),
                    TmpFolder:   os.TempDir(),
                    CacheTTL:    c.Duration("cache"),
                    Port:        c.Int("port"),
                    MongoClient: client,
                }
                return analyzer.Serve()
            },
		},
		{
			Name:        "open",
			Description: "Open a given project in local server",
			Flags: []cli.Flag{
				&cli.IntFlag{
					Name:    "port",
					Aliases: []string{"p"},
					Value:   defaultPort,
					Usage:   "Local server port",
					EnvVars: []string{"PORT"},
				},
				&cli.StringFlag{
					Name:    "branch",
					Aliases: []string{"b"},
					Value:   "master",
					Usage:   "Specify a custom branch",
				},
			},
			Action: func(c *cli.Context) error {
				var local bool
				projectAddress := c.Args().First()

				stat, err := os.Stat(projectAddress)
				if os.IsNotExist(err) {
					url, ok := lib.GetGithubBaseURL(c.Args().First())
					if !ok {
						return fmt.Errorf("project path not found")
					}
					projectAddress = url
				} else if !stat.IsDir() || projectAddress == "" {
					return fmt.Errorf("invalid project path")
				} else {
					local = true
				}

				client, _, cancel, err := connectMongo(MONGO_URI)
                if err != nil {
                    return err
                }
                defer cancel()

                analyzer := server.AnalyzerHandle{
                    Cache:       lib.NewCache(),
                    TmpFolder:   os.TempDir(),
                    Port:        c.Int("port"),
                    ProjectPath: &projectAddress,
                    Local:       local,
                    MongoClient: client,
                }

				if branch := c.String("branch"); branch != "" {
					analyzer.Branch = &branch
				}

				return analyzer.Serve()
			},
		},
	}

	log.SetFormatter(&log.TextFormatter{
		FullTimestamp: true,
	})
	log.SetOutput(os.Stdout)
	log.SetLevel(log.InfoLevel)
	if err := app.Run(os.Args); err != nil {
		log.Error(err)
	}
}
