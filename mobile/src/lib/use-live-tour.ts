import { useEffect, useMemo, useRef, useState } from 'react';

import {
  ARRIVAL_METRES,
  Location,
  MAX_ACCURACY_METRES,
  nearest,
  requestForegroundLocation,
  type Located,
} from './geo';

/**
 * Follows a tour on foot, switching the current stop as the broker arrives.
 *
 * Only runs while the caller says so, and tears the subscription down the
 * moment it stops -- there is no background tracking anywhere in this app.
 *
 * Two pieces of restraint keep it from flickering between buildings. A fix
 * that the phone itself calls vague is ignored rather than acted on, and once
 * a stop is current it holds until the broker is clearly nearer another one
 * -- without that, standing on the line between two options on the same
 * business park would swap the screen back and forth while they walked.
 */

/** Extra distance a rival stop must beat the current one by before it takes over. */
const SWITCH_MARGIN_METRES = 40;

export type LiveState = {
  /** The stop the broker appears to be at, or null when between buildings. */
  currentStopId: string | null;
  /** Distance to the nearest stop, whether or not it counts as arrival. */
  metres: number | null;
  /** The nearest stop, even when out of range -- for "next stop is 400 m away". */
  nearestStopId: string | null;
  error: string | null;
  /** True once permission is granted and a first fix is still pending. */
  locating: boolean;
};

const IDLE: LiveState = {
  currentStopId: null,
  metres: null,
  nearestStopId: null,
  error: null,
  locating: false,
};

export function useLiveTour(
  stops: Located<{ id: string }>[],
  enabled: boolean,
): LiveState {
  const [state, setState] = useState<LiveState>(IDLE);
  const currentRef = useRef<string | null>(null);

  // Restarting the watch every render would be a permission prompt loop, so
  // the effect keys on the coordinates rather than the array's identity.
  const key = useMemo(
    () => stops.map((stop) => `${stop.id}:${stop.latitude},${stop.longitude}`).join('|'),
    [stops],
  );

  useEffect(() => {
    if (!enabled || !stops.length) {
      currentRef.current = null;
      setState(IDLE);
      return;
    }

    let active = true;
    let subscription: Location.LocationSubscription | null = null;

    setState({ ...IDLE, locating: true });

    (async () => {
      const permission = await requestForegroundLocation();
      if (!active) return;

      if (!permission.granted) {
        setState({ ...IDLE, error: permission.message });
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          // Walking pace: enough to notice arriving without waking the radio
          // every second.
          distanceInterval: 20,
          timeInterval: 8_000,
        },
        (position) => {
          if (!active) return;

          // The phone's own estimate of how wrong it might be. A 200 m fix
          // cannot distinguish two buildings 150 m apart, so it is not used.
          const accuracy = position.coords.accuracy;
          if (accuracy != null && accuracy > MAX_ACCURACY_METRES) return;

          const closest = nearest(position.coords, stops);
          if (!closest) return;

          const current = currentRef.current;
          const currentStop = current ? stops.find((stop) => stop.id === current) : null;
          const currentDistance = currentStop
            ? nearest(position.coords, [currentStop])?.metres ?? Infinity
            : Infinity;

          let next: string | null;
          if (closest.metres > ARRIVAL_METRES) {
            next = null;
          } else if (!currentStop || closest.item.id === current) {
            next = closest.item.id;
          } else {
            // Hold the current stop unless the rival is meaningfully closer.
            next = closest.metres + SWITCH_MARGIN_METRES < currentDistance ? closest.item.id : current;
          }

          currentRef.current = next;
          setState({
            currentStopId: next,
            metres: closest.metres,
            nearestStopId: closest.item.id,
            error: null,
            locating: false,
          });
        },
      );
    })().catch(() => {
      if (active) setState({ ...IDLE, error: 'Could not read your location.' });
    });

    return () => {
      active = false;
      subscription?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  return state;
}
