# Capture and exit if we interrupt the loop
function trap_ctrlc() {
  exit 2
}

trap "trap_ctrlc" 2

# Run the passed versions against the tests
function test_versions() {
  for version in $1
  do
    yarn install --frozen-lockfile
    yarn add --dev typescript@$version
    yarn test:types
  done
}

# Parse options to the `supported-versions` command
while getopts ":h" opt; do
  case ${opt} in
    h )
      echo "Usage:"
      echo "    supported-versions -h               Display this help message."
      echo "    supported-versions test <versions>  Test your types against a list of comma seperated list of semver versions."
      exit 0
      ;;
   \? )
     echo "Invalid Option: -$OPTARG" 1>&2
     exit 1
     ;;
  esac
done

shift $((OPTIND -1))

subcommand=$1; shift  # Remove 'supported-versions' from the argument list
case "$subcommand" in
  # Parse options to the test sub command
  test )
    versions=$(echo $1 | tr "," "\n"); shift
    test_versions $versions
    ;;
  * )
     echo "Invalid Option: $subcommand" 1>&2
     exit 1
     ;;
esac