FROM golang:1.15.6 as builder
ENV APP_DIR /go/src/github.com/tarao/apiconsole

WORKDIR ${APP_DIR}
COPY . .
ENV CGO_ENABLED 0
RUN go get ./... && go build .

FROM alpine:3.19.1
ENV APP_DIR /go/src/github.com/tarao/apiconsole

COPY --from=builder ${APP_DIR}/apiconsole /usr/local/bin/
EXPOSE 8000
ENTRYPOINT ["/usr/local/bin/apiconsole"]
