package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/GeertJohan/go.rice"
)

func main() {
	upstream := flag.String(
		"upstream",
		"http://localhost",
		"An upstream server to which all requests are forwarded.",
	)
	mount := flag.String(
		"mount",
		"/devel/console",
		"A mount point that the console is served.  Note that the static files related to the console are also served under this path.",
	)
	port := flag.Int(
		"port",
		8000,
		"Port to listen",
	)
	flag.Parse()

	staticHandler := http.FileServer(rice.MustFindBox("static").HTTPBox())

	upstreamURL, err := url.Parse(*upstream)
	if err != nil {
		panic(err)
	}
	upstreamHandler := httputil.NewSingleHostReverseProxy(upstreamURL)

	go func() {
		log.Printf("Console: http://localhost:%d%s", *port, *mount)
	}()

	panic(http.ListenAndServe(fmt.Sprintf(":%d", *port), &handler{
		staticPath:      *mount,
		staticHandler:   http.StripPrefix(*mount, staticHandler),
		upstreamHandler: upstreamHandler,
	}))
}

type handler struct {
	staticPath      string
	staticHandler   http.Handler
	upstreamHandler http.Handler
}

func (h *handler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	method := req.Method
	path := req.URL.Path
	res := &responseWithStatus{ResponseWriter: w}
	defer func() {
		log.Printf(
			"method:%s\tpath:%s\tstatus:%d",
			method,
			path,
			res.status,
		)
	}()

	if strings.HasPrefix(req.URL.Path, h.staticPath) {
		h.staticHandler.ServeHTTP(res, req)
		return
	}

	h.upstreamHandler.ServeHTTP(res, req)
}

type responseWithStatus struct {
	http.ResponseWriter
	status int
}

func (r *responseWithStatus) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}
