#!/usr/bin/python

import sys
 
country = 'in'
#device = 'Sony_Ericsson-K750'
device = "Nokia N85 8Gb"

from struct import pack, unpack
from httplib import HTTP

cid = sys.argv[1]; 
lac = sys.argv[2];

cid = long(cid);
lac = long(lac);

def fetch_latlong_http(query):
    http = HTTP('www.google.com', 80)
    http.putrequest('POST', '/glm/mmap')
    http.putheader('Content-Type', 'application/binary')
    http.putheader('Content-Length', str(len(query)))
    http.endheaders()
    http.send(query)
    code, msg, headers = http.getreply()
    result = http.file.read()
    return result
  
fetch_latlong = fetch_latlong_http
 
def get_location_by_cell(cid, lac, mnc=0, mcc=0, country='in'):
    b_string = pack('>hqh2sh13sh5sh3sBiiihiiiiii',
                    21, 0,
                    len(country), country,
                    len(device), device,
                    len('1.3.1'), "1.3.1",
                    len('Web'), "Web",
                    27, 0, 0,
                    3, 0, cid, lac,
                    0, 0, 0, 0)

    bytes = fetch_latlong(b_string)
    (a, b,errorCode, latitude, longitude, c, d, e) = unpack(">hBiiiiih",bytes)
    latitude = latitude / 1000000.0
    longitude = longitude / 1000000.0
 
    location = str(latitude) + "," + str(longitude)
    return location
  
if __name__ == '__main__':
    print get_location_by_cell(cid, lac, 86, 404)
    