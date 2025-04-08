1.The source code of "golfbot" is in /root/golfbot
  To access the vps and upload, download files, you have to use "Filzila".
  You can adjust and modify any files and folders using this.
2.For update of bot, 
-First, you have to upload latest code to vps.
-Second, access to vps using RealVNC or UltraVNC.
-Third, go to "golfbot" folder in VPS
-Finally, type these commands one by one.
"sudo docker-compose down"
"sudo docker-compose up --build"
"sudo docker-compose up -d"
"sudo docker ps"

Then you can check updated website.