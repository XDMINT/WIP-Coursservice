# just install curl because image from dagu is lite-weight
FROM ghcr.io/dagucloud/dagu:2.6.10

USER root
RUN if command -v apk > /dev/null; then apk add --no-cache curl; else apt-get update && apt-get install -y curl; fi