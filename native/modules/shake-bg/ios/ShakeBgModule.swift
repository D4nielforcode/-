import ExpoModulesCore
import CoreMotion
import CoreLocation
import UserNotifications
import UIKit

public class ShakeBgModule: Module {
  private static let shared = ShakeRunner()

  public func definition() -> ModuleDefinition {
    Name("ShakeBg")

    AsyncFunction("start") { (fortunes: [String]) -> Bool in
      ShakeBgModule.shared.start(fortunes: fortunes)
      return true
    }

    AsyncFunction("stop") { () -> Bool in
      ShakeBgModule.shared.stop()
      return true
    }

    AsyncFunction("isRunning") { () -> Bool in
      return ShakeBgModule.shared.running
    }
  }
}

final class ShakeRunner: NSObject, CLLocationManagerDelegate {
  private let motion = CMMotionManager()
  private let location = CLLocationManager()
  private var fortunes: [String] = []
  private var lastShake: TimeInterval = 0
  private let cooldown: TimeInterval = 4.0
  private let threshold: Double = 2.2 // G force
  private(set) var running = false
  private var bgTask: UIBackgroundTaskIdentifier = .invalid

  override init() {
    super.init()
    location.delegate = self
    location.desiredAccuracy = kCLLocationAccuracyThreeKilometers
    location.distanceFilter = 99999 // we don't care about location, just the keepalive
    location.pausesLocationUpdatesAutomatically = false
    if #available(iOS 9.0, *) {
      location.allowsBackgroundLocationUpdates = true
    }
    if #available(iOS 11.0, *) {
      location.showsBackgroundLocationIndicator = false
    }
  }

  func start(fortunes: [String]) {
    self.fortunes = fortunes
    // Request Always-authorization so updates continue in background.
    let status: CLAuthorizationStatus
    if #available(iOS 14.0, *) {
      status = location.authorizationStatus
    } else {
      status = CLLocationManager.authorizationStatus()
    }
    if status == .notDetermined || status == .authorizedWhenInUse {
      location.requestAlwaysAuthorization()
    }
    location.startUpdatingLocation()

    if motion.isAccelerometerAvailable {
      motion.accelerometerUpdateInterval = 0.1
      motion.startAccelerometerUpdates(to: OperationQueue()) { [weak self] data, _ in
        guard let self = self, let a = data?.acceleration else { return }
        let g = sqrt(a.x*a.x + a.y*a.y + a.z*a.z)
        if g > self.threshold {
          let now = Date().timeIntervalSince1970
          if now - self.lastShake > self.cooldown {
            self.lastShake = now
            self.fireFortune()
          }
        }
      }
    }
    running = true
  }

  func stop() {
    motion.stopAccelerometerUpdates()
    location.stopUpdatingLocation()
    running = false
  }

  private func fireFortune() {
    guard !fortunes.isEmpty else { return }
    let text = fortunes.randomElement()!

    // Extend background time briefly to ensure notification posts
    bgTask = UIApplication.shared.beginBackgroundTask(withName: "fortune.notify") { [weak self] in
      guard let self = self else { return }
      UIApplication.shared.endBackgroundTask(self.bgTask)
      self.bgTask = .invalid
    }

    let content = UNMutableNotificationContent()
    content.title = "🥠 오늘의 포춘쿠키"
    content.body = text
    content.sound = .default

    let req = UNNotificationRequest(
      identifier: "fortune-\(UUID().uuidString)",
      content: content,
      trigger: nil
    )
    UNUserNotificationCenter.current().add(req) { [weak self] _ in
      guard let self = self else { return }
      if self.bgTask != .invalid {
        UIApplication.shared.endBackgroundTask(self.bgTask)
        self.bgTask = .invalid
      }
    }
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}
  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {}
}
