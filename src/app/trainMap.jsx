import React from 'react';
import TrainMapStop from './trainMapStop.jsx';
import { cloneDeep } from "lodash";

const M_TRAIN_SHUFFLE = ["M18", "M16", "M14", "M13", "M12", "M11"];

class TrainMap extends React.Component {
  calculateStops() {
    const { routing } = this.props;
    const southStops = {};
    const northStops = {};

    if (!routing) {
      return;
    }

    routing.routings.south.forEach((r) => {
      r.forEach((obj) => {
        const stopId = obj.substring(0, 3);
        southStops[stopId] = true;
      });
    });
    routing.routings.north.forEach((r) => {
      r.forEach((obj) => {
        const stopId = obj.substring(0, 3);
        northStops[stopId] = true;
      });
    }); 

    return {southStops: southStops, northStops: northStops};
  }

  generateSegments() {
    const { routing, stations } = this.props;

    if (!routing ) {
      return;
    }

    const southRoutings = routing.routings.south.map((obj) => {
      return obj.map((stop) => {
        return stop.substring(0, 3);
      });
    });

    const northRoutings = routing.routings.north.map((obj) => {
      return obj.map((stop) => {
        return stop.substring(0, 3);
      }).reverse();
    });

    const allRoutings = southRoutings.concat(northRoutings).sort((a, b) => {
      return b.length - a.length ;
    });

    const longestLine = allRoutings[0];

    if (!longestLine) {
      return;
    }

    const lines = allRoutings.filter((routing) => {
      return routing.every(station => !longestLine.includes(station));
    });

    lines.push(longestLine);

    const line = lines.sort((a, b) => {
      return stations[b[0]].latitude - stations[a[0]].latitude;
    })[0];

    const lineCopy = [...line];
    const branches = [lineCopy];

    const remainingRoutings = [];

    allRoutings.forEach((lineObj) => {
      if (lineObj.every(val => line.includes(val))) {
        return;
      }
      let lastMatchingStop = null;
      let stopsToBeAdded = [];

      lineObj.forEach((stop) => {
        if (line.includes(stop)) {
          if (stopsToBeAdded.length) {
            const currStopPosition = line.indexOf(stop);

            if (!lastMatchingStop) {
              const matchingBranchToAppend = branches.find((obj) => {
                return obj.indexOf(stop) == 0;
              })

              if (matchingBranchToAppend) {
                const branchStartPosInLine = line.indexOf(matchingBranchToAppend[0]);
                line.splice(branchStartPosInLine, 0, ...stopsToBeAdded);
                matchingBranchToAppend.splice(0, 0, ...stopsToBeAdded);
              } else {
                // branch from the top
                line.splice(currStopPosition, 0, ...stopsToBeAdded);
                stopsToBeAdded.push(stop)
                branches.push(stopsToBeAdded);
              }
            } else {
              const branchToInsert = branches.find((obj) => {
                const prevMatchingStopPosition = obj.indexOf(lastMatchingStop);
                const currMatchingStopPosition = obj.indexOf(stop);

                return prevMatchingStopPosition > -1 && currMatchingStopPosition > -1 && (currMatchingStopPosition - prevMatchingStopPosition) === 1;
              });
              const branchToPrependBeginning = branches.find((obj) => {
                const prevMatchingStopPosition = obj.indexOf(lastMatchingStop);
                const currMatchingStopPosition = obj.indexOf(stop);

                return prevMatchingStopPosition == -1 && currMatchingStopPosition == 0;
              });

              const branchToAppendEnd = branches.find((obj) => {
                const prevMatchingStopPosition = obj.indexOf(lastMatchingStop);
                const currMatchingStopPosition = obj.indexOf(stop);

                return prevMatchingStopPosition == (obj.length - 1) && currMatchingStopPosition == -1;
              });

              if (branchToInsert) {
                // adding intermediate stops
                line.splice(currStopPosition, 0, ...stopsToBeAdded);
                const lastMatchingStopPositionInBranch = branchToInsert.indexOf(lastMatchingStop);
                branchToInsert.splice(lastMatchingStopPositionInBranch + 1, 0, ...stopsToBeAdded);
              } else if (branchToPrependBeginning) {
                // prepend to beginning of a branch
                line.splice(currStopPosition - 1, 0, ...stopsToBeAdded);
                stopsToBeAdded.splice(0, 0, lastMatchingStop);
                branchToPrependBeginning.splice(0, 0, ...stopsToBeAdded);
              } else if (branchToAppendEnd) {
                // append to end of a branch
                const linePos = line.indexOf(lastMatchingStop);
                line.splice(linePos + 1, 0, ...stopsToBeAdded);
                stopsToBeAdded.push(stop);
                branchToAppendEnd.splice(branchToAppendEnd.length - 1, 0, ...stopsToBeAdded);
              } else {
                // adding middle branch
                line.splice(currStopPosition, 0, ...stopsToBeAdded);
                stopsToBeAdded.splice(0, 0, lastMatchingStop);
                stopsToBeAdded.push(stop);
                branches.push(stopsToBeAdded);
              }
            }
          }
          stopsToBeAdded = [];
          lastMatchingStop = stop;
        } else {
          stopsToBeAdded.push(stop);
        }
      });

      if (stopsToBeAdded.length) {
        if (lastMatchingStop === line[line.length - 1]) {
          // append to end of line
          line.splice(line.length, 0, ...stopsToBeAdded);
          branches[0].splice(branches[0].length - 1, 0, ...stopsToBeAdded);
        } else {
          // branch from the bottom
          if (lastMatchingStop) {
            const lastMatchingStopPosition = line.indexOf(lastMatchingStop);
            line.splice(lastMatchingStopPosition + 1, 0, ...stopsToBeAdded);
            stopsToBeAdded.splice(0, 0, lastMatchingStop);
          } else {
            line.push("");
            line.splice(line.length, 0, ...stopsToBeAdded);
          }
          branches.push(stopsToBeAdded);
        }
      }
    });

    return {
      line: line,
      branches: branches
    };
  }

  render() {
    const { routing, stops } = this.props;
    const segments = this.generateSegments();
    const stopPattern = this.calculateStops();

    let currentBranches = [0];
    if (segments) {
      return(
        <div>
          <ul style={{listStyleType: "none", textAlign: "left", margin: "auto", padding: 0}}>
            {
              segments.line.map((stopId, lineIndex) => {
                let branchStart = null;
                let branchEnd = null;
                let branchStops = [];
                let count = 0;
                const stop = stops[stopId];
                const currentMaxBranch = currentBranches[currentBranches.length - 1];
                let transfers = stop && cloneDeep(stop.trains.filter(route => route.id != routing.id));

                if (stopId === "") {
                  segments.branches.splice(0, 1);
                  currentBranches = [];
                } else {
                  const potentialBranch = segments.branches.find((obj, index) => {
                    return !currentBranches.includes(index) && obj.includes(stopId);
                  });
                  if (potentialBranch) {
                    const potentialBranchIndex = segments.branches.indexOf(potentialBranch);
                    const currentBranchIncludesStop = currentBranches.find((obj) => {
                      return segments.branches[obj].includes(stopId);
                    });
                    const branchesToTraverse = [...currentBranches];
                    if (currentBranchIncludesStop || currentBranchIncludesStop === 0) {
                      branchStart = currentBranchIncludesStop;
                      segments.branches[potentialBranchIndex].splice(0, 1);
                    } else {
                      branchesToTraverse.push(potentialBranchIndex);
                    }

                    branchesToTraverse.forEach((obj) => {
                      let branchStopsHere = segments.branches[obj].includes(stopId);
                      branchStops.push(branchStopsHere);
                      if (branchStopsHere) {
                        const i = segments.branches[obj].indexOf(stopId);
                        segments.branches[obj].splice(i, 1);
                      }
                    });
                    currentBranches.push(potentialBranchIndex);
                  } else if (currentBranches.length > 1 &&
                      (segments.branches[currentMaxBranch][segments.branches[currentMaxBranch].length - 1] === stopId) &&
                      segments.branches[currentBranches[currentBranches.length - 2]].includes(stopId)) {
                    branchEnd = currentBranches[currentBranches.length - 2];

                    currentBranches.pop();
                    // branch back
                    currentBranches.forEach((obj) => {
                      let branchStopsHere = segments.branches[obj].includes(stopId);
                      branchStops.push(branchStopsHere);
                      if (branchStopsHere) {
                        const i = segments.branches[obj].indexOf(stopId);
                        segments.branches[obj].splice(i, 1);
                      }
                    });
                  } else if (currentBranches.length > 1 && segments.branches[currentMaxBranch].length === 0) {
                    // branch ends
                    currentBranches.pop();

                    currentBranches.forEach((obj) => {
                      let branchStopsHere = segments.branches[obj].includes(stopId);
                      branchStops.push(branchStopsHere);
                      if (branchStopsHere) {
                        const i = segments.branches[obj].indexOf(stopId);
                        segments.branches[obj].splice(i, 1);
                      }
                    });
                  } else {
                    currentBranches.forEach((obj) => {
                      let branchStopsHere = segments.branches[obj].includes(stopId);
                      branchStops.push(branchStopsHere);
                      if (branchStopsHere) {
                        const i = segments.branches[obj].indexOf(stopId);
                        segments.branches[obj].splice(i, 1);
                      }
                    });
                  }
                }
                const activeBranches = branchStops.map((isStopping, index) => {
                  return isStopping || segments.branches[index].length > 0;
                });
                if (M_TRAIN_SHUFFLE.includes(stopId)) {
                  if (routing.id === 'M') {
                    transfers = transfers.map((t) => {
                      if (t.directions.length === 1) {
                        if (t.directions[0] === 'north') {
                          t.directions[0] = 'south';
                        } else {
                          t.directions[0] = 'north';
                        }
                        return t;
                      }
                      return t;
                    });
                  } else {
                    transfers = transfers.map((t) => {
                      if (t.id === 'M') {
                        if (t.directions.length === 1) {
                          if (t.directions[0] === 'north') {
                            t.directions[0] = 'south';
                          } else {
                            t.directions[0] = 'north';
                          }
                          return t;
                        }
                        return t;
                      } else {
                        return t;
                      }
                    });
                  }
                }
                return (
                  <TrainMapStop key={stopId} stop={stop} color={routing.color} southStop={stopPattern.southStops[stopId]}
                    northStop={stopPattern.northStops[stopId]} transfers={transfers} branchStops={branchStops} branchStart={branchStart}
                    branchEnd={branchEnd} activeBranches={activeBranches} />
                )
              })
            }
          </ul>
        </div>
      )
    }
    return (<div></div>)
  }
}
export default TrainMap