import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('collector', Path(__file__).with_name('collect-licenses.py'))
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


class ArtifactNoticeTests(unittest.TestCase):
    def test_notices_in_aar_jars_are_retained_with_their_paths(self):
        nested = io.BytesIO()
        with zipfile.ZipFile(nested, 'w') as jar:
            jar.writestr('META-INF/NOTICE', 'Required upstream credit')
            jar.writestr('SomeClass.class', b'not a notice')
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / 'release.aar'
            with zipfile.ZipFile(artifact, 'w') as aar:
                aar.writestr('LICENSE.txt', 'Permission terms')
                aar.writestr('classes.jar', nested.getvalue())
                aar.writestr('libs/helper.jar', nested.getvalue())
            self.assertEqual(collector.artifact_notices(artifact), [
                {'path': 'LICENSE.txt', 'text': 'Permission terms'},
                {'path': 'classes.jar!/META-INF/NOTICE', 'text': 'Required upstream credit'},
                {'path': 'libs/helper.jar!/META-INF/NOTICE', 'text': 'Required upstream credit'},
            ])
