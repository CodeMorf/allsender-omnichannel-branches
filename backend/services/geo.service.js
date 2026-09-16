import { point, distance, booleanPointInPolygon } from '@turf/turf';

const validCoords = (coordinates) => Array.isArray(coordinates)
  && coordinates.length === 2
  && Number.isFinite(Number(coordinates[0]))
  && Number.isFinite(Number(coordinates[1]));

export class BranchGeoService {
  distanceKm(from, branch) {
    const coordinates = branch?.location?.coordinates;
    if (!validCoords(coordinates) || !Number.isFinite(Number(from?.latitude)) || !Number.isFinite(Number(from?.longitude))) return null;
    return distance(
      point([Number(from.longitude), Number(from.latitude)]),
      point([Number(coordinates[0]), Number(coordinates[1])]),
      { units: 'kilometers' }
    );
  }

  containsLocation(branch, location) {
    if (!location) return false;
    if (branch.coverage_mode === 'polygon' && branch.coverage_polygon) {
      try {
        return booleanPointInPolygon(point([Number(location.longitude), Number(location.latitude)]), branch.coverage_polygon);
      } catch {
        return false;
      }
    }
    const km = this.distanceKm(location, branch);
    if (km == null) return false;
    if (branch.coverage_mode === 'radius') return km <= Number(branch.coverage_radius_km || 0);
    return true;
  }

  rankByLocation(branches, location) {
    return branches
      .map((branch) => ({ branch, distance_km: this.distanceKm(location, branch), inside: this.containsLocation(branch, location) }))
      .filter((item) => item.distance_km != null)
      .sort((a, b) => Number(b.inside) - Number(a.inside) || a.distance_km - b.distance_km);
  }

  findBestBranch(branches, location) {
    const ranked = this.rankByLocation(branches, location);
    if (!ranked.length) return null;
    // Never force a customer into a radius/polygon branch when the shared location is outside coverage.
    // Branches with coverage_mode="none" are considered inside by containsLocation().
    return ranked.find((item) => item.inside) || null;
  }
}

export default new BranchGeoService();
