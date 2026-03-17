require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'PaidAppDetector'
  s.version        = package['version']
  s.summary        = 'Expo module to detect paid app purchases via App Store receipt'
  s.description    = 'Reads AppTransaction to determine if the app was originally purchased'
  s.author         = package['name']
  s.homepage       = 'https://github.com/nealw98/daily-paths'
  s.platforms      = { :ios => '16.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
