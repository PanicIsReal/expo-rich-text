require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))
repository = package['repository']
repository_url = repository.is_a?(Hash) ? repository['url'] : repository

Pod::Spec.new do |s|
  s.name = 'ExpoRichText'
  s.version = package['version']
  s.summary = package['description']
  s.description = package['description']
  s.license = package['license']
  s.author = package['author']
  s.homepage = package['homepage'] || repository_url
  s.platforms = { ios: '26.0' }
  s.swift_version = '5.9'
  s.source = { git: repository_url, tag: s.version.to_s }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'ExpoUI'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,mm,swift}'
  s.resource_bundles = {
    'ExpoRichTextShaders' => ['**/*.metal']
  }
end
