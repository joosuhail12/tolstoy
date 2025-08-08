class Tolstoy < Formula
  desc "Official CLI for Tolstoy workflow automation platform"
  homepage "https://docs.tolstoy.dev"
  version "1.1.0"
  
  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/tolstoy-dev/cli/releases/download/v#{version}/tolstoy-cli-macos-arm64.tar.gz"
      sha256 "" # Will be updated during release
    else
      url "https://github.com/tolstoy-dev/cli/releases/download/v#{version}/tolstoy-cli-macos-x64.tar.gz"  
      sha256 "" # Will be updated during release
    end
  end

  on_linux do
    url "https://github.com/tolstoy-dev/cli/releases/download/v#{version}/tolstoy-cli-linux-x64.tar.gz"
    sha256 "" # Will be updated during release
  end

  def install
    # The binary is in a subdirectory named after the platform
    platform_dir = Dir.glob("*").first
    bin.install "#{platform_dir}/tolstoy"
  end

  test do
    # Basic version check
    assert_match version.to_s, shell_output("#{bin}/tolstoy --version")
    
    # Test help command
    assert_match "Official CLI for Tolstoy workflow automation platform", 
                 shell_output("#{bin}/tolstoy --help")
  end
end