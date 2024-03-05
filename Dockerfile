# Define the base image from AWS Lambda Node.js 18.x runtime
FROM public.ecr.aws/lambda/nodejs:18

# Install system dependencies required for Puppeteer and Chromium
RUN yum -y update && yum -y install \
    alsa-lib \
    atk \
    cups-libs \
    gtk3 \
    ipa-gothic-fonts \
    libXcomposite \
    libXcursor \
    libXdamage \
    libXext \
    libXi \
    libXrandr \
    libXScrnSaver \
    libXtst \
    pango \
    xorg-x11-fonts-100dpi \
    xorg-x11-fonts-75dpi \
    xorg-x11-fonts-cyrillic \
    xorg-x11-fonts-misc \
    xorg-x11-fonts-Type1 \
    xorg-x11-utils \
    nss \
    -y && yum clean all

# Copy the package.json and package-lock.json (if available)
COPY package*.json ${LAMBDA_TASK_ROOT}/

# Install NPM dependencies, including Puppeteer
RUN npm install && npm cache clean --force

# Copy the rest of the application
COPY . ${LAMBDA_TASK_ROOT}/

RUN npx puppeteer browsers install chrome

# Set the CMD to your handler (this should match the handler method in your Node.js application)
CMD ["index.handler"]
