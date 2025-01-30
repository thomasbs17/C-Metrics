sudo dnf install python3-devel -y

# TA-Lib Installation:
sudo yum install gcc -y

curl -SLO https://github.com/ta-lib/ta-lib/releases/download/v0.6.4/ta-lib-0.6.4-src.tar.gz
tar -xzf ta-lib-0.6.4-src.tar.gz
cd ta-lib-0.6.4/
./configure --prefix=/usr
make
sudo make install
cd ..