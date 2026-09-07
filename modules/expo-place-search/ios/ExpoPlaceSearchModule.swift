import Contacts
import ExpoModulesCore
import MapKit

public final class ExpoPlaceSearchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoPlaceSearch")

    AsyncFunction("search") {
      (
        query: String,
        latitude: Double?,
        longitude: Double?,
        requestedLimit: Int
      ) async throws -> [[String: Any]] in
      let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
      guard normalizedQuery.count >= 2 else {
        return []
      }

      let request = MKLocalSearch.Request()
      request.naturalLanguageQuery = normalizedQuery
      request.resultTypes = [.address, .pointOfInterest]

      if let latitude, let longitude,
         (-90.0...90.0).contains(latitude),
         (-180.0...180.0).contains(longitude) {
        request.region = MKCoordinateRegion(
          center: CLLocationCoordinate2D(
            latitude: latitude,
            longitude: longitude
          ),
          span: MKCoordinateSpan(
            latitudeDelta: 1.8,
            longitudeDelta: 2.4
          )
        )
      }

      let response = try await MKLocalSearch(request: request).start()
      let limit = max(1, min(12, requestedLimit))

      return response.mapItems.prefix(limit).map { item in
        let placemark = item.placemark
        let title = item.name?.trimmingCharacters(in: .whitespacesAndNewlines)
          ?? placemark.name?.trimmingCharacters(in: .whitespacesAndNewlines)
          ?? normalizedQuery

        let street = [placemark.subThoroughfare, placemark.thoroughfare]
          .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
          .filter { !$0.isEmpty }
          .joined(separator: " ")
        let cityLine = [placemark.postalCode, placemark.locality]
          .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
          .filter { !$0.isEmpty }
          .joined(separator: " ")
        var addressParts = [
          street,
          cityLine,
          placemark.administrativeArea?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
          placemark.country?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        ].filter { !$0.isEmpty }
        if addressParts.isEmpty {
          addressParts = [title]
        }

        var result: [String: Any] = [
          "title": title,
          "displayName": addressParts.joined(separator: ", "),
          "latitude": placemark.coordinate.latitude,
          "longitude": placemark.coordinate.longitude
        ]
        if let countryCode = placemark.isoCountryCode?.lowercased() {
          result["countryCode"] = countryCode
        }
        return result
      }
    }
  }
}
