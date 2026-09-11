sdown () {
    if [ "$1" == "-h" ]; then
      echo "Usage: sdown [-h] [FILE]"
      echo "Downloading the specified file (only valid in SCOW)."
      return 0
    fi
    if [ $# -eq 0 ];then
      echo "Please enter the file name you want to download."
      return 0
    fi
    if [ $# -gt 1 ];then
      echo "Please enter only one file name. Multiple file names are not supported."
      return 0
    fi
    result=$(echo $@ | grep "/")
    if [[ "$result" != "" ]]
    then
        echo "sdown does not support relative paths. Please enter the file name."
        return 0
    fi
    if [ ! -f "$@" ]; then
      echo  "File $@ does not exist."
      return 0
    fi
    echo  "SCOW is downloading file $@ in directory `pwd`"
    echo  "This command is only valid for SCOW web shells."
}

sopen () {
    if [ "$1" == "-h" ]; then
      echo "Usage: sopen [-h]"
      echo "Open file explorer (only valid in SCOW)."
      return 0
    fi
    echo "SCOW is opening the file system `pwd`"
    echo  "This command is only valid for SCOW web shells."
}

sedit () {
    if [ "$1" == "-h" ]; then
      echo "Usage: sedit [-h] [FILE]"
      echo "Use the sedit command to open a text editor. (only valid in SCOW)."
      return 0
    fi
    if [ "$#" -eq 0 ]; then
      echo "Error: Please enter the file you want to edit."
      echo "Usage: sedit [file_path]"
      return 0
    elif [ "$#" -gt 1 ]; then
      echo "Error: The sedit command only accepts one argument."
      echo "Usage: sedit [file_path]"
      return 0
    fi
    result=$(echo $@ | grep "/")
    if [[ "$result" != "" ]]
    then
        echo "sedit does not support relative paths. Please enter the file name."
        return 0
    fi
    if [ ! -f "$@" ]; then
      echo  "File $@ does not exist."
      return 0
    fi
    echo "SCOW is redirecting to the editor for the file $@ in directory `pwd`"
    echo  "This command is only valid for SCOW web shells."
}

sup () {
    if [ "$1" == "-h" ]; then
      echo "Usage: sup [-h]"
      echo "Use the sup command to upload a file. (only valid in SCOW)."
      return 0
    fi
    echo "SCOW is uploading files in directory `pwd`"
    echo  "This command is only valid for SCOW web shells."
}
