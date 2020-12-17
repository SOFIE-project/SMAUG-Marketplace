from setuptools import setup, find_packages

setup(
    name='sofie_interledger',
    version='0.1',
    description=(
        'Template implementation of the SOFIE project\'s '
        'Interledger component'
    ),
    url='https://github.com/SOFIE-project/Interledger',
    author='SOFIE Project',
    author_email='sofie-offer-interledger@sofie-iot.eu',
    license='APL 2.0',
    package_dir={'': 'src'},
    packages=find_packages(where='src'),
    install_requires=[
        'web3',
        'sqlalchemy',
        'requests',
    ],
    tests_require=['pytest', 'pytest-asyncio'],
    zip_safe=False
)
