FROM public.ecr.aws/lambda/nodejs:18

# Install Xvfb
RUN yum update -y && \
    yum install -y bzip2 gtk3 dbus-glib libXt xorg-x11-server-Xvfb ImageMagick xz procps xorg-x11-utils

# Install latest Google Chrome browser
RUN curl -o chrome.rpm https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
RUN yum install -y chrome.rpm

WORKDIR ${LAMBDA_TASK_ROOT}

COPY package*.json ${LAMBDA_TASK_ROOT}/
RUN npm install
COPY teste.js ${LAMBDA_TASK_ROOT}/

# Required for Xvfb
ENV DISPLAY=":99.0"

RUN mkdir -p /var/run/dbus && dbus-daemon --config-file=/usr/share/dbus-1/system.conf --print-address

CMD ["teste.handler"]